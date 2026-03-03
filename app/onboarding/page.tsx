'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChallengeStore, Difficulty } from '@/store/useChallengeStore';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const { updateProfile } = useAuthStore();
  const { startChallenge, addSideQuest } = useChallengeStore();
  const router = useRouter();

  // Step 1: Biometrics
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  // Step 2: Side Quests
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);
  const availableQuests = [
    { id: 'q1', title: '10k Steps Daily', difficulty: 'Medium' as const, durationDays: 30 },
    { id: 'q2', title: 'Intermittent Fasting (16:8)', difficulty: 'Hard' as const, durationDays: 14 },
    { id: 'q3', title: 'Meditation 10m', difficulty: 'Easy' as const, durationDays: 21 },
  ];

  // Step 3: Challenge Selection
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [customGoals, setCustomGoals] = useState<string[]>(['Drink 1 Gallon water', 'Read 10 pages', 'Workout 45m']);

  const handleNext = () => {
    if (step === 1) {
      updateProfile({
        age: age ? parseInt(age) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        height: height ? parseFloat(height) : undefined,
      });
      setStep(2);
    } else if (step === 2) {
      selectedQuests.forEach(qId => {
        const q = availableQuests.find(aq => aq.id === qId);
        if (q) addSideQuest({ title: q.title, difficulty: q.difficulty, durationDays: q.durationDays });
      });
      setStep(3);
    } else if (step === 3) {
      const formattedCustomGoals = customGoals.map(g => ({ title: g }));
      startChallenge(difficulty, difficulty === 'Custom' ? formattedCustomGoals : undefined);
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 max-w-2xl mx-auto pt-12">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
        ))}
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-6 md:p-10 border border-zinc-100 dark:border-zinc-800">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">About You</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Let&apos;s set up your baseline metrics.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none" placeholder="e.g. 25" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Weight (kg)</label>
                <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none" placeholder="e.g. 75.5" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Height (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none" placeholder="e.g. 175" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Side Quests</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Optional dynamic activities to boost your journey.</p>
            </div>

            <div className="space-y-3">
              {availableQuests.map((quest) => (
                <div 
                  key={quest.id}
                  onClick={() => setSelectedQuests(prev => prev.includes(quest.id) ? prev.filter(id => id !== quest.id) : [...prev, quest.id])}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedQuests.includes(quest.id) ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{quest.title}</h3>
                    <span className="text-xs font-medium px-2 py-1 bg-white dark:bg-zinc-900 rounded-md">{quest.difficulty}</span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{quest.durationDays} days challenge</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Choose Difficulty</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Select your main 75 Days Challenge plan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['Soft', 'Medium', 'Hard', 'Custom'] as Difficulty[]).map((diff) => (
                <div 
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${difficulty === diff ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50' : 'border-transparent bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                >
                  <h3 className="font-bold text-lg">{diff}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {diff === 'Soft' && 'A gentle start to build habits.'}
                    {diff === 'Medium' && 'Balanced challenge for steady progress.'}
                    {diff === 'Hard' && 'The original, uncompromising 75 Days.'}
                    {diff === 'Custom' && 'Build your own rules based on Hard.'}
                  </p>
                </div>
              ))}
            </div>

            {difficulty === 'Custom' && (
              <div className="mt-6 space-y-3">
                <h4 className="font-medium">Custom Goals</h4>
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
                      className="flex-1 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none outline-none"
                    />
                    <button onClick={() => setCustomGoals(customGoals.filter((_, index) => index !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl">
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={() => setCustomGoals([...customGoals, ''])} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  + Add Goal
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="flex items-center px-6 py-3 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <ChevronLeft size={20} className="mr-2" /> Back
          </button>
        ) : <div></div>}
        
        <button onClick={handleNext} className="flex items-center px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          {step === 3 ? 'Start Challenge' : 'Next'} <ChevronRight size={20} className="ml-2" />
        </button>
      </div>
    </div>
  );
}
