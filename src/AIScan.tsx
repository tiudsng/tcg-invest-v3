import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { X, Image as ImageIcon, Settings, Check, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { toast } from 'sonner';

export const AIScan = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gameSelection, setGameSelection] = useState('Trading Card Games');

  const videoConstraints = {
    facingMode: 'environment',
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImage) return;
    
    setIsAnalyzing(true);
    try {
      const match = capturedImage.match(/^data:(image\/\w+);base64,/);
      const mimeType = match ? match[1] : "image/jpeg";
      const base64Data = capturedImage.replace(/^data:image\/\w+;base64,/, "");

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: 'Identify this trading card. Return ONLY a valid JSON object with a single key "name" containing the card\'s name or character\'s name in Traditional Chinese or Japanese (e.g., {"name": "噴火龍"}). Do not include markdown formatting like ```json.' },
              { inlineData: { data: base64Data, mimeType: mimeType } }
            ]
          }
        ]
      });

      const text = response.text;
      if (!text) throw new Error("No text returned from AI");

      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleanedText);

      if (data && data.name) {
        toast.success(`AI 辨識成功：${data.name}`);
        // Navigate to search or create listing with the identified name
        navigate(`/search?q=${encodeURIComponent(data.name)}`);
      } else {
        toast.error('無法辨識卡牌');
        setCapturedImage(null);
      }
    } catch (err) {
      console.error('AI Error:', err);
      toast.error('AI 辨識失敗');
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 pt-safe">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        <button className="flex items-center gap-2 text-white font-semibold text-lg drop-shadow-md">
          {gameSelection}
          <ChevronDown className="w-5 h-5" />
        </button>
        
        <div className="w-10 h-10" /> {/* Spacer for centering */}
      </div>

      {/* Camera / Preview Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center bg-zinc-900">
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Scanning Frame Overlay */}
        {!capturedImage && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-6 pb-20">
            <div className="w-full max-w-md aspect-[3/4] border-2 border-white/90 rounded-3xl relative shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]">
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30"
            >
              <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
              <p className="text-white font-semibold text-lg tracking-wider">AI 辨識中...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="bg-[#2c2422] rounded-t-3xl pb-safe relative z-20 -mt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <div className="p-6">
          {!capturedImage ? (
            <div className="bg-[#1c1c1e] text-white px-6 py-4 rounded-xl mb-6 flex items-center justify-center">
              <p className="text-[15px]">Scan the <span className="text-teal-400 font-medium">front</span> of the card to get started.</p>
            </div>
          ) : (
             <div className="bg-[#1c1c1e] text-white px-6 py-4 rounded-xl mb-6 flex items-center justify-center">
              <p className="text-[15px]">確認圖片清晰後，點擊右下角按鈕進行辨識。</p>
            </div>
          )}

          <div className="flex justify-end mb-4">
            <span className="text-teal-400 text-sm font-medium">Total: <span className="text-white">$0.00</span></span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <ImageIcon className="w-7 h-7" />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleGalleryUpload} 
                />
              </button>
              
              {!capturedImage && (
                <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <Settings className="w-6 h-6" />
                </button>
              )}
            </div>

            {capturedImage ? (
              <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
                <button 
                  onClick={handleRetake}
                  className="px-6 py-3 rounded-full bg-white/10 flex items-center justify-center text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  重拍
                </button>
              </div>
            ) : (
              <button 
                onClick={capture}
                className="w-20 h-20 rounded-full bg-white absolute left-1/2 -translate-x-1/2 active:scale-95 transition-transform"
              />
            )}

            <button 
              onClick={capturedImage ? handleAnalyze : undefined}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${capturedImage ? 'bg-white text-black hover:bg-gray-200' : 'bg-white/10 text-gray-400'}`}
              disabled={!capturedImage || isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
