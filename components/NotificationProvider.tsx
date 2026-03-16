import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: NotificationType;
}

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel: string;
    cancelLabel: string;
    variant: NotificationType;
}

interface NotificationContextType {
    showToast: (message: string, type?: NotificationType) => void;
    confirm: (options: {
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel?: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
        variant?: NotificationType;
    }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmState, setConfirmState] = useState<ConfirmState>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        onCancel: () => { },
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'info'
    });

    const showToast = useCallback((message: string, type: NotificationType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const confirm = useCallback((options: {
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel?: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
        variant?: NotificationType;
    }) => {
        setConfirmState({
            isOpen: true,
            title: options.title,
            message: options.message,
            onConfirm: () => {
                options.onConfirm();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            },
            onCancel: () => {
                if (options.onCancel) options.onCancel();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            },
            confirmLabel: options.confirmLabel || 'Confirm',
            cancelLabel: options.cancelLabel || 'Cancel',
            variant: options.variant || 'info'
        });
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showToast, confirm }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-scale-in min-w-[300px] max-w-md ${toast.type === 'success' ? 'bg-green-50/90 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300' :
                            toast.type === 'error' ? 'bg-red-50/90 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' :
                                toast.type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300' :
                                    'bg-blue-50/90 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                            }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}

                        <p className="text-sm font-medium flex-1">{toast.message}</p>

                        <button onClick={() => removeToast(toast.id)} className="text-current opacity-50 hover:opacity-100 transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Modal */}
            {confirmState.isOpen && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-gray-100 dark:border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${confirmState.variant === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                                    confirmState.variant === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' :
                                        'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                    }`}>
                                    {confirmState.variant === 'error' ? <AlertTriangle className="w-6 h-6" /> :
                                        confirmState.variant === 'warning' ? <AlertTriangle className="w-6 h-6" /> :
                                            <Info className="w-6 h-6" />}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{confirmState.title}</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                                {confirmState.message}
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={confirmState.onCancel}
                                    className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                                >
                                    {confirmState.cancelLabel}
                                </button>
                                <button
                                    onClick={confirmState.onConfirm}
                                    className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition transform active:scale-95 ${confirmState.variant === 'error' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-red-950/20' :
                                        confirmState.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 dark:shadow-amber-950/20' :
                                            'bg-blue-900 hover:bg-blue-800 shadow-blue-200 dark:shadow-blue-950/20'
                                        }`}
                                >
                                    {confirmState.confirmLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new NotificationContextError('useNotification must be used within a NotificationProvider');
    }
    return context;
};

class NotificationContextError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotificationContextError';
    }
}
