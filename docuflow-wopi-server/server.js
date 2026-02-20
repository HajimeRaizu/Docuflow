require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 18000;

// Middleware
app.use(cors());
// WOPI requires raw body for PutFile operations
app.use('/wopi/files/:file_id/contents', express.raw({ type: '*/*', limit: '50mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase Initialization
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
// In-Memory Lock Store for WOPI (In production, use Redis or Postgres table)
// Format: { file_id: { lockId: "uuid", expiresAt: timestamp } }
const locks = {};

// Keep-Alive Ping for Render
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// WOPI Endpoint: CheckFileInfo (Returns metadata about the file)
app.get('/wopi/files/:file_id', async (req, res) => {
    const fileId = req.params.file_id;
    const accessToken = req.query.access_token;

    console.log(`[WOPI] CheckFileInfo requested for file: ${fileId}`);

    if (!accessToken) {
        return res.status(401).send('Unauthorized: Missing access_token');
    }

    try {
        // Fetch document metadata from docuflow database
        const { data: document, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error || !document) {
            console.error("[WOPI] File not found in DB:", error);
            return res.status(404).send('File not found');
        }

        // We also need the size of the BLOB in storage. 
        // For simplicity, we can fetch it or default to a safe value.
        // It's better to get actual size from Supabase Storage if possible, but WOPI often accepts 0 if unknown.
        let fileSize = 0;
        try {
            // We assume the active version is documents/${fileId}.docx unless logic changes
            const { data: fileData, error: fileError } = await supabase
                .storage
                .from('documents')
                .download(`${fileId}.docx`);

            if (fileData) fileSize = fileData.size;
        } catch (e) { /* ignore */ }

        // Construct CheckFileInfo Response
        // https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/endpoints/checkfileinfo
        const checkFileInfo = {
            BaseFileName: `${document.title || 'Document'}.docx`,
            OwnerId: document.user_id,
            Size: fileSize,
            UserId: 'editor', // Could extract from JWT token if implemented
            Version: document.updated_at,
            // Permissions
            UserCanWrite: true,
            SupportsLocks: true,
            SupportsUpdate: true,
            UserCanNotWriteRelative: true, // Prevents creating sibling files
        };

        res.status(200).json(checkFileInfo);

    } catch (err) {
        console.error('[WOPI] CheckFileInfo Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// WOPI Endpoint: GetFile (Returns the raw binary content of the file)
app.get('/wopi/files/:file_id/contents', async (req, res) => {
    const fileId = req.params.file_id;
    console.log(`[WOPI] GetFile requested for file: ${fileId}`);

    try {
        // Fetch the file blob from Supabase Storage
        const { data, error } = await supabase
            .storage
            .from('documents')
            .download(`${fileId}.docx`); // Adjust extension as needed

        if (error || !data) {
            console.error("[WOPI] Error downloading file blob:", error);
            return res.status(404).send('File blob not found');
        }

        // Convert Blob to ArrayBuffer then to Buffer
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.status(200).send(buffer);

    } catch (err) {
        console.error('[WOPI] GetFile Error:', err);
        res.status(500).send('Internal Server Error');
    }
});


// WOPI File Operations Router (PutFile, Lock, Unlock, RefreshLock)
app.post('/wopi/files/:file_id', async (req, res) => {
    const fileId = req.params.file_id;
    // WOPI Client sends instructions via the X-WOPI-Override header
    const wopiOverride = req.headers['x-wopi-override'] || req.headers['X-WOPI-Override'];
    const lockHeader = req.headers['x-wopi-lock'] || req.headers['X-WOPI-Lock'];
    const oldLockHeader = req.headers['x-wopi-oldlock'] || req.headers['X-WOPI-OldLock'];

    console.log(`[WOPI] POST Operation: ${wopiOverride} for file: ${fileId}`);

    if (!wopiOverride) {
        return res.status(400).send('Missing X-WOPI-Override header');
    }

    switch (wopiOverride) {
        case 'LOCK':
            if (!lockHeader) return res.status(400).send('Missing X-WOPI-Lock header');

            if (!locks[fileId]) {
                // File is currently fully unlocked. Grant the lock.
                locks[fileId] = { lockId: lockHeader, expiresAt: Date.now() + 30 * 60 * 1000 };
                res.setHeader('X-WOPI-Lock', lockHeader);
                return res.status(200).send('');
            } else if (locks[fileId].lockId === lockHeader) {
                // Same lock requested again, just refresh
                locks[fileId].expiresAt = Date.now() + 30 * 60 * 1000;
                res.setHeader('X-WOPI-Lock', lockHeader);
                return res.status(200).send('');
            } else {
                // File is locked by someone else
                res.setHeader('X-WOPI-Lock', locks[fileId].lockId);
                return res.status(409).send('Conflict'); // 409 Conflict
            }

        case 'UNLOCK':
            if (!lockHeader) return res.status(400).send('Missing X-WOPI-Lock header');

            if (!locks[fileId]) {
                return res.status(409).send('File not locked');
            } else if (locks[fileId].lockId === lockHeader) {
                delete locks[fileId];
                return res.status(200).send('');
            } else {
                res.setHeader('X-WOPI-Lock', locks[fileId].lockId);
                return res.status(409).send('Conflict');
            }

        case 'REFRESH_LOCK':
            if (!lockHeader) return res.status(400).send('Missing X-WOPI-Lock header');

            if (!locks[fileId]) {
                return res.status(409).send('File not locked');
            } else if (locks[fileId].lockId === lockHeader) {
                locks[fileId].expiresAt = Date.now() + 30 * 60 * 1000;
                res.setHeader('X-WOPI-Lock', lockHeader);
                return res.status(200).send('');
            } else {
                res.setHeader('X-WOPI-Lock', locks[fileId].lockId);
                return res.status(409).send('Conflict');
            }

        case 'PUT':
        case 'PUT_RELATIVE':
            return res.status(501).send('Not Implemented - Use /contents endpoint');

        default:
            return res.status(501).send('Not Implemented');
    }
});

// WOPI Endpoint: PutFile (Saves the updated file back to storage)
app.post('/wopi/files/:file_id/contents', async (req, res) => {
    const fileId = req.params.file_id;
    const lockHeader = req.headers['x-wopi-lock'] || req.headers['X-WOPI-Lock'];
    console.log(`[WOPI] PutFile requested for file: ${fileId}`);

    // Verify Lock
    if (!locks[fileId] || locks[fileId].lockId !== lockHeader) {
        res.setHeader('X-WOPI-Lock', locks[fileId] ? locks[fileId].lockId : '');
        return res.status(409).send('Lock mismatch');
    }

    try {
        // req.body contains the raw binary stream from Collabora
        if (!req.body || req.body.length === 0) {
            return res.status(400).send('Empty file body');
        }

        // Upload the new buffer to Supabase Storage
        // We overwrite the existing file. Co-editing is handled by Collabora CODE server in RAM.
        // It only sends PutFile when the last user leaves or occasionally for auto-save.
        const { data, error } = await supabase
            .storage
            .from('documents')
            .upload(`${fileId}.docx`, req.body, {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                upsert: true
            });

        if (error) {
            console.error("[WOPI] Error uploading file blob:", error);
            return res.status(500).send('Failed to upload file');
        }

        // Optionally, update the generic 'updated_at' timestamp in the database
        await supabase
            .from('documents')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', fileId);

        res.sendStatus(200);

    } catch (err) {
        console.error('[WOPI] PutFile Error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Start Server
app.listen(port, () => {
    console.log(`=== WOPI Host Server listening on port ${port} ===`);
});
