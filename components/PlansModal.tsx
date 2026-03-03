'use client';

import { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { X, Target } from 'lucide-react';

export default function PlansModal() {
  const { isPlansModalOpen, closePlansModal } = useUIStore();
  const { startChallenge, isActive, difficulty: currentDifficulty } = useChallengeStore();
  const [difficulty, setDifficulty] = useState<Difficulty>(currentDifficulty || 'Medium');
  const [customGoals, setCustomGoals] = useState<string[]>(['Agua (3.7L)', 'Lectura (10 págs)', 'Entrenamiento 45m']);

  if (!isPlansModalOpen) return null;

  const handleStart = () => {
    if (isActive) {
      if (!confirm('Ya tienes un desafío activo. ¿Estás seguro de que quieres reiniciarlo con un nuevo plan? Perderás tu racha actual.')) {
        return;
      }
    }
    const formattedCustomGoals = customGoals.map(g => ({ title: g }));
    startChallenge(difficulty, difficulty === 'Custom' ? formattedCustomGoals : undefined);
    closePlansModal();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1c0f16] border border-[#361726] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Target className="text-[#f43f5e]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Seleccionar Plan</h2>
          </div>
          <button onClick={closePlansModal} className="text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-white/60 text-sm">
            Elige la dificultad principal de tu desafío. Cambiar de plan reiniciará tu progreso actual.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['Soft', 'Medium', 'Hard', 'Custom'] as Difficulty[]).map((diff) => (
              <div 
                key={diff}
                onClick={() => setDifficulty(diff)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  difficulty === diff 
                    ? 'border-[#f43f5e] bg-[#f43f5e]/10' 
                    : 'border-[#361726] bg-[#050505] hover:border-[#f43f5e]/50 hover:bg-[#26151e]'
                }`}
              >
                <h3 className="font-bold text-lg text-white">{diff}</h3>
                <p className="text-sm text-white/50 mt-1">
                  {diff === 'Soft' && 'Un comienzo suave para crear hábitos.'}
                  {diff === 'Medium' && 'Desafío equilibrado para progreso constante.'}
                  {diff === 'Hard' && 'El original, sin compromisos. 75 Días Hard.'}
                  {diff === 'Custom' && 'Crea tus propias reglas basadas en Hard.'}
                </p>
              </div>
            ))}
          </div>

          {difficulty === 'Custom' && (
            <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2">
              <h4 className="font-medium text-white">Metas Personalizadas</h4>
              {customGoals.map((goal, i) => (
                <div key={i} className="flex gap-2">
                  <input 
                    type="text" 
                    value={goal}
                    onChange={(e) => {
                      const newGoals = [...customGoals];
                      newGoals[i] = e.target.value;
                      setCustomGoals(newGoals);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#050505] border border-[#361726] text-white outline-none focus:border-[#f43f5e] transition-colors"
                  />
                  <button 
                    onClick={() => setCustomGoals(customGoals.filter((_, index) => index !== i))} 
                    className="px-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/30"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setCustomGoals([...customGoals, ''])} 
                className="text-sm font-medium text-[#f43f5e] hover:text-[#f43f5e]/80 transition-colors mt-2"
              >
                + Añadir Meta
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-[#050505]">
          <button 
            onClick={closePlansModal} 
            className="px-6 py-3 rounded-xl font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleStart} 
            className="px-8 py-3 bg-[#f43f5e] text-white rounded-xl font-bold hover:bg-[#e11d48] transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)]"
          >
            {isActive ? 'Reiniciar Desafío' : 'Comenzar Desafío'}
          </button>
        </div>

      </div>
    </div>
  );
}
