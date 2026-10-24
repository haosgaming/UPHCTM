import React, { useState } from 'react';
import { X, FileText, Check, Edit3, Eye } from 'lucide-react';

interface DocumentationDrawerProps {
  isOpen: boolean;
  title: string;
  initialMarkdown: string;
  onClose: () => void;
  onSave: (markdown: string) => void;
}

export const DocumentationDrawer: React.FC<DocumentationDrawerProps> = ({
  isOpen,
  title,
  initialMarkdown,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [content, setContent] = useState(initialMarkdown);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#141a26] border-l border-white/15 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#00F0FF]" />
          <div>
            <h3 className="font-bold text-white text-sm truncate max-w-[240px]">{title}</h3>
            <p className="text-[11px] text-gray-400">Technická dokumentace & poznámky (Markdown)</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode Toolbar */}
      <div className="px-4 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
              mode === 'edit' ? 'bg-[#00F0FF] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editor
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
              mode === 'preview' ? 'bg-[#00F0FF] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Náhled
          </button>
        </div>

        <button
          onClick={handleSave}
          className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-[#10B981]/20"
        >
          <Check className="w-3.5 h-3.5" />
          {saved ? 'Uloženo!' : 'Uložit poznámky'}
        </button>
      </div>

      {/* Editor or Preview */}
      <div className="flex-1 p-4 overflow-y-auto">
        {mode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Zadejte technické poznámky v Markdownu..."
            className="w-full h-full bg-[#0a0d14] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-200 leading-relaxed focus:outline-none focus:border-[#00F0FF] resize-none"
          />
        ) : (
          <div className="prose prose-invert prose-xs max-w-none text-gray-300 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
            {content || <span className="italic text-gray-500">Žádné poznámky nebyly zadány.</span>}
          </div>
        )}
      </div>

      {/* Footer tips */}
      <div className="p-3 bg-black/40 border-t border-white/10 text-[11px] text-gray-500">
        Podpora formátování: Nadpisy (#), seznamy (-), tučný text (**text**), kód (`code`).
      </div>
    </div>
  );
};
