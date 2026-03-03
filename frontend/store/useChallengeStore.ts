import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format, isSameDay, subDays, differenceInDays } from 'date-fns';

export type Difficulty = 'Soft' | 'Medium' | 'Hard' | 'Custom';

export interface GoalTemplate {
  title: string;
  description?: string;
  icon?: string;
}

export interface Goal extends GoalTemplate {
  id: string;
  completed: boolean;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  goals: Goal[];
  weight?: number;
  photoUrl?: string;
  notes?: string;
  status: 'success' | 'fail' | 'rest' | 'pending';
}

export interface SideQuest {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  durationDays: number;
  startedAt: string;
  progress: number; // days completed
  completed: boolean;
}

export interface ChallengeState {
  isActive: boolean;
  difficulty: Difficulty | null;
  startDate: string | null;
  currentDay: number;
  streak: number;
  logs: Record<string, DailyLog>;
  sideQuests: SideQuest[];
  points: number;
  achievements: string[];
  bestWeight: number | null;
  challengesCompleted: number;
  customGoalsTemplate: GoalTemplate[];

  // Actions
  startChallenge: (difficulty: Difficulty, customGoals?: GoalTemplate[]) => void;
  abandonChallenge: () => void;
  logDailyGoal: (date: string, goalId: string, completed: boolean) => void;
  logDailyWeight: (date: string, weight: number) => void;
  logDailyPhoto: (date: string, photoUrl: string) => void;
  logDailyNotes: (date: string, notes: string) => void;
  addSideQuest: (quest: Omit<SideQuest, 'id' | 'startedAt' | 'progress' | 'completed'>) => void;
  progressSideQuest: (questId: string) => void;
  checkDailyReset: () => void;
}

const DEFAULT_GOALS: Record<string, GoalTemplate[]> = {
  Soft: [
    { title: 'Agua (2L)', description: 'Beber al menos 2 litros de agua.', icon: 'droplet' },
    { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
    { title: 'Entrenamiento', description: '30 minutos de actividad física.', icon: 'dumbbell' }
  ],
  Medium: [
    { title: 'Agua (3L)', description: 'Beber al menos 3 litros de agua.', icon: 'droplet' },
    { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro.', icon: 'book' },
    { title: 'Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
    { title: 'Dieta', description: 'Seguir una dieta saludable.', icon: 'utensils' }
  ],
  Hard: [
    { title: 'Dieta Estricta', description: 'Seguir una dieta sin comidas trampa ni alcohol.', icon: 'utensils' },
    { title: 'Primer Entrenamiento', description: '45 minutos de actividad física.', icon: 'dumbbell' },
    { title: 'Segundo Entrenamiento', description: '45 minutos, debe ser al aire libre (O cumplir al menos 8000 pasos).', icon: 'sun' },
    { title: 'Agua (3.7L)', description: 'Beber un galón (aprox. 3.7 litros) de agua.', icon: 'droplet' },
    { title: 'Lectura (10 págs)', description: 'Leer 10 páginas de un libro de no ficción.', icon: 'book' },
    { title: 'Foto de Progreso', description: 'Tomar una foto de progreso diaria.', icon: 'camera' }
  ],
};

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      difficulty: null,
      startDate: null,
      currentDay: 0,
      streak: 0,
      logs: {},
      sideQuests: [],
      points: 0,
      achievements: [],
      bestWeight: null,
      challengesCompleted: 0,
      customGoalsTemplate: [],

      startChallenge: (difficulty, customGoals) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const goalsTemplate = difficulty === 'Custom' ? (customGoals || []) : DEFAULT_GOALS[difficulty];
        
        set({
          isActive: true,
          difficulty,
          startDate: today,
          currentDay: 1,
          streak: 0,
          customGoalsTemplate: goalsTemplate,
          logs: {
            [today]: {
              date: today,
              status: 'pending',
              goals: goalsTemplate.map((g, i) => ({ ...g, id: `g-${i}`, completed: false })),
            }
          }
        });
      },

      abandonChallenge: () => {
        set({ isActive: false, difficulty: null, startDate: null, currentDay: 0, streak: 0 });
      },

      logDailyGoal: (date, goalId, completed) => {
        set((state) => {
          const log = state.logs[date];
          if (!log) return state;

          const updatedGoals = log.goals.map(g => g.id === goalId ? { ...g, completed } : g);
          const allCompleted = updatedGoals.every(g => g.completed);
          
          let newPoints = state.points;
          let newAchievements = [...state.achievements];
          
          if (allCompleted && log.status !== 'success') {
            newPoints += 10;
            if (state.streak + 1 === 1 && !newAchievements.includes('Completar el día 1')) {
              newAchievements.push('Completar el día 1');
            }
            if (state.streak + 1 === 7 && !newAchievements.includes('Racha de 7 días')) {
              newAchievements.push('Racha de 7 días');
            }
          }

          return {
            logs: {
              ...state.logs,
              [date]: { ...log, goals: updatedGoals, status: allCompleted ? 'success' : 'pending' }
            },
            points: newPoints,
            achievements: newAchievements,
          };
        });
      },

      logDailyWeight: (date, weight) => {
        set((state) => {
          const log = state.logs[date];
          const bestWeight = state.bestWeight === null || weight < state.bestWeight ? weight : state.bestWeight;
          return {
            logs: { ...state.logs, [date]: { ...(log || { date, goals: [], status: 'pending' }), weight } },
            bestWeight
          };
        });
      },

      logDailyPhoto: (date, photoUrl) => {
        set((state) => {
          const log = state.logs[date];
          return {
            logs: { ...state.logs, [date]: { ...(log || { date, goals: [], status: 'pending' }), photoUrl } }
          };
        });
      },

      logDailyNotes: (date, notes) => {
        set((state) => {
          const log = state.logs[date];
          return {
            logs: { ...state.logs, [date]: { ...(log || { date, goals: [], status: 'pending' }), notes } }
          };
        });
      },

      addSideQuest: (quest) => {
        set((state) => ({
          sideQuests: [
            ...state.sideQuests,
            { ...quest, id: `sq-${Date.now()}`, startedAt: format(new Date(), 'yyyy-MM-dd'), progress: 0, completed: false }
          ]
        }));
      },

      progressSideQuest: (questId) => {
        set((state) => ({
          sideQuests: state.sideQuests.map(q => {
            if (q.id === questId && !q.completed) {
              const newProgress = q.progress + 1;
              return { ...q, progress: newProgress, completed: newProgress >= q.durationDays };
            }
            return q;
          })
        }));
      },

      checkDailyReset: () => {
        const state = get();
        if (!state.isActive || !state.startDate) return;

        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        
        const yesterdayLog = state.logs[yesterday];
        let newStreak = state.streak;
        
        if (yesterdayLog) {
           if (yesterdayLog.status !== 'success') {
             newStreak = 0;
             if (yesterdayLog.status === 'pending') {
               set((s) => ({
                 logs: { ...s.logs, [yesterday]: { ...yesterdayLog, status: 'fail' } }
               }));
             }
           }
        } else if (differenceInDays(new Date(), new Date(state.startDate)) > 0) {
           newStreak = 0;
           set((s) => ({
             logs: { ...s.logs, [yesterday]: { date: yesterday, goals: [], status: 'fail' } }
           }));
        }

        if (!state.logs[today]) {
          const goalsTemplate = state.difficulty === 'Custom' ? state.customGoalsTemplate : DEFAULT_GOALS[state.difficulty as keyof typeof DEFAULT_GOALS];
          set((s) => ({
            streak: newStreak,
            currentDay: differenceInDays(new Date(), new Date(s.startDate!)) + 1,
            logs: {
              ...s.logs,
              [today]: {
                date: today,
                status: 'pending',
                goals: goalsTemplate.map((g, i) => ({ ...g, id: `g-${i}`, completed: false })),
              }
            }
          }));
        } else {
           set({ streak: newStreak });
        }
      }
    }),
    {
      name: 'challenge-storage',
    }
  )
);
