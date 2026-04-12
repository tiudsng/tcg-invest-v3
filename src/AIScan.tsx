import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { X, Image as ImageIcon, Settings, Check, ChevronDown, Loader2, Camera, FolderUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SchemaType } from '@google/generative-ai';
import { toast } from 'sonner';
import { compressImage, compressBase64 } from './lib/imageUtils';

export const AIScan = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<{name: string, cardNumber?: string, priceHKD?: number} | null>(null);
  const [gameSelection, setGameSelection] = useState('Trading Card Games');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [useBasicConstraints, setUseBasicConstraints] = useState(false);

  const videoConstraints = useBasicConstraints ? true : {
    facingMode: { ideal: 'environment' }
  };

  const handleCameraError = (error: string | DOMException) => {
    console.error('Webcam Error:', error);
    setCameraError(typeof error === 'string' ? error : error.message);
  };

  const tryBasicCamera = () => {
    setCameraError(null);
    setUseBasicConstraints(true);
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      try {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          setCapturedImage(imageSrc);
        } else {
          toast.error('無法擷取圖片，請重試');
        }
      } catch (err) {
        console.error('Capture Error:', err);
        toast.error('擷取失敗');
      }
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setCapturedImage(null);
    setScanResult(null);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressedBase64 = await compressImage(file);
        setCapturedImage(compressedBase64);
      } catch (error) {
        console.error('Error handling gallery upload:', error);
        toast.error('圖片處理失敗');
      }
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImage) return;
    
    setIsAnalyzing(true);
    try {
      // Ensure image is compressed before sending to avoid payload too large errors
      const compressedImage = await compressBase64(capturedImage);

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: compressedImage,
          prompt: 'Identify this trading card. Find its card number. Use Google Search to find the recent eBay market value for this specific card in **PSA 10** condition, and convert it to Hong Kong Dollars (HKD). Return a JSON object. If you cannot identify the card, return "Unknown" for the name.',
          schema: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING, description: "Card name in Traditional Chinese or Japanese. Return 'Unknown' if cannot identify." },
              cardNumber: { type: SchemaType.STRING, description: "Card number (e.g., 201/165)" },
              priceHKD: { type: SchemaType.NUMBER, description: "Estimated eBay price for PSA 10 in HKD" }
            },
            required: ["name"]
          }
        })
      });

      if (!response.ok) {
        let errorMessage = '辨識失敗';
        try {
          const text = await response.text();
          try {
            const errData = JSON.parse(text);
            errorMessage = errData.error || errorMessage;
          } catch (e) {
            errorMessage = `伺服器錯誤 (${response.status}): ${text.substring(0, 100)}`;
          }
        } catch (e) {
          errorMessage = `伺服器錯誤 (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Invalid JSON response:", text);
        throw new Error(`伺服器回傳了非預期的格式: ${text.substring(0, 100)}`);
      }

      if (data && data.name && data.name !== "Unknown") {
        toast.success(`AI 辨識成功：${data.name}`);
        setScanResult(data);
      } else {
        toast.error('無法辨識卡牌，請確保圖片清晰並重試');
        setCapturedImage(null);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(`AI 辨識失敗: ${err.message || '未知錯誤'}`);
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[50] bg-black flex flex-col font-sans">
      {/* Camera / Preview Area - Takes remaining space */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMediaError={handleCameraError}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-6 text-center">
                <Settings className="w-12 h-12 text-gray-500 mb-4" />
                <p className="text-white font-bold mb-2">無法啟動相機</p>
                <p className="text-gray-400 text-sm mb-6">{cameraError}</p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button 
                    onClick={tryBasicCamera}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform"
                  >
                    嘗試預設相機
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold active:scale-95 transition-transform"
                  >
                    從相簿上傳
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-white/5 text-white/60 rounded-xl font-bold active:scale-95 transition-transform"
                  >
                    重新整理頁面
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Scanning Frame Overlay */}
        {!capturedImage && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-8">
            <div className="w-full max-w-sm aspect-[63/88] border-2 border-white rounded-3xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
            </div>
          </div>
        )}

        {/* Analyzing Overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-30"
            >
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-white font-semibold text-lg tracking-wider">AI 辨識中...</p>
              <p className="text-white/60 text-sm mt-2">正在搜尋最新市場價格</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header - Floating inside camera area */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 pt-safe bg-gradient-to-b from-black/50 to-transparent">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:bg-gray-200 transition-colors shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="w-10 h-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Bottom Controls - Dark Panel */}
      <div className="bg-black p-6 pb-[100px] relative z-20 flex-shrink-0">
        {scanResult ? (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">{scanResult.name}</h3>
                {scanResult.cardNumber && <p className="text-gray-400 font-medium">{scanResult.cardNumber}</p>}
              </div>
              <button onClick={() => {setScanResult(null); setCapturedImage(null);}} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
              <p className="text-blue-400 text-sm font-medium mb-1">eBay PSA 10 預估市值</p>
              <p className="text-3xl font-bold text-white">
                {scanResult.priceHKD ? `HK$${scanResult.priceHKD.toLocaleString()}` : '暫無資料'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate(`/?q=${encodeURIComponent(scanResult.name)}`)} className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors">
                在市集搜尋
              </button>
              <button onClick={() => navigate(`/create?q=${encodeURIComponent(scanResult.name)}`)} className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors">
                我要賣這張
              </button>
            </div>
          </motion.div>
        ) : capturedImage ? (
           <div className="flex flex-col gap-4">
              <div className="bg-[#3a3a3c] text-white px-6 py-4 rounded-[20px] flex items-center justify-center">
                <p className="text-[15px] font-medium">確認圖片清晰後，點擊開始辨識。</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleRetake}
                  className="py-4 rounded-[20px] bg-[#3a3a3c] flex items-center justify-center text-white font-semibold hover:bg-[#4a4a4c] transition-colors"
                >
                  重拍
                </button>
                <button 
                  onClick={handleAnalyze}
                  className="py-4 rounded-[20px] bg-blue-600 flex items-center justify-center text-white font-semibold hover:bg-blue-500 transition-colors"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : '開始辨識'}
                </button>
              </div>
           </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
              <button onClick={capture} className="flex flex-col items-center justify-center gap-2">
                <div className="w-[72px] h-[72px] bg-[#2c2c2e] rounded-[24px] flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                  <Camera className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-white font-semibold text-[13px]">Take Photo</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2">
                <div className="w-[72px] h-[72px] bg-[#2c2c2e] rounded-[24px] flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                  <FolderUp className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-white font-semibold text-[13px]">Local Upload</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleGalleryUpload} 
                />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
