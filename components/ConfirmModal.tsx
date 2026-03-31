import React from 'react';
import { AlertTriangle, Info, X, CheckCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmJson?: string;
    cancelLabel?: string;
    confirmLabel?: string;
    showCancel?: boolean;
    variant?: 'danger' | 'info' | 'warning' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    showCancel = true,
    variant = 'info'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${variant === 'danger' ? 'text-red-600 dark:text-red-400' :
                        variant === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                            variant === 'success' ? 'text-indigo-600 dark:text-indigo-400' :
                                'text-blue-600 dark:text-blue-400'
                        }`}>
                        {variant === 'danger' && <AlertTriangle className="w-5 h-5" />}
                        {variant === 'warning' && <AlertTriangle className="w-5 h-5" />}
                        {variant === 'info' && <Info className="w-5 h-5" />}
                        {variant === 'success' && <CheckCircle className="w-5 h-5" />}
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                            variant === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                variant === 'success' ? 'bg-indigo-600 hover:bg-indigo-700' :
                                    'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
