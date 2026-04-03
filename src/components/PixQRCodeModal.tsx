import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone, Download } from 'lucide-react';
import { generatePixPayload } from '../lib/pix';
import { useSettings } from '../contexts/SettingsContext';

interface PixQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description?: string;
  transactionId?: string;
}

export default function PixQRCodeModal({
  isOpen,
  onClose,
  amount,
  description,
  transactionId
}: PixQRCodeModalProps) {
  const { settings } = useSettings();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasPixConfig = settings.pixKey && settings.pixName && settings.pixCity;

  const pixPayload = hasPixConfig
    ? generatePixPayload({
        key: settings.pixKey!,
        name: settings.pixName!,
        city: settings.pixCity!,
        amount,
        description,
        transactionId
      })
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('pix-qrcode');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `pix-cobranca-${amount.toFixed(2)}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-color)] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-[var(--text-main)]">Cobrança PIX</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="h-6 w-6" />
          </button>
        </div>

        {!hasPixConfig ? (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Smartphone className="h-6 w-6" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Você precisa configurar sua Chave PIX nas configurações antes de gerar cobranças.
            </p>
            <button 
              onClick={onClose}
              className="btn btn-primary w-full"
            >
              Entendi
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-100">
                <QRCodeSVG
                  id="pix-qrcode"
                  value={pixPayload}
                  size={220}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: settings.logoUrl || "https://logopng.com.br/logos/pix-106.png",
                    x: undefined,
                    y: undefined,
                    height: 44,
                    width: 44,
                    excavate: true,
                  }}
                />
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="h-5 w-5 bg-[#32BCAD] rounded flex items-center justify-center">
                    <Smartphone className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-[#32BCAD] tracking-widest uppercase">PIX</span>
                </div>
                <p className="text-3xl font-black text-[var(--text-main)]">R$ {amount.toFixed(2)}</p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-bold mt-1">Escaneie para pagar</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCopy}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  copied 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--text-main)] hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Pix Copia e Cola'}
              </button>

              <button
                onClick={downloadQRCode}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
              >
                <Download className="h-4 w-4" />
                Salvar QR Code
              </button>
            </div>

            <p className="text-[10px] text-center text-[var(--text-muted)] italic">
              O pagamento cai na hora na conta de: <br/>
              <span className="font-bold text-[var(--text-main)]">{settings.pixName}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
