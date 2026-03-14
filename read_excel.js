import * as fs from 'fs';
import * as xlsx from 'xlsx';

const buf = fs.readFileSync("c:\\Users\\Joshua\\Desktop\\Docuflow\\MERGED Basis PPMP price list.xlsx");
const workbook = xlsx.read(buf);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

fs.writeFileSync("c:\\Users\\Joshua\\Desktop\\Docuflow\\parsed_excel.json", JSON.stringify(data, null, 2));
