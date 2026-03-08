/**
 * Mock implementation of FatSecret API due to IP whitelisting restrictions.
 * We emulate the same endpoints but hook it up to a local robust food dictionary 
 * to ensure that frontend features can still be developed and tested.
 */

interface MockFood {
    id: string;
    name: string;
    description: string;
    brand: string | null;
    servings: {
        id: string;
        description: string;
        metricAmount: string;
        metricUnit: string;
        calories: number;
        carbohydrates: number;
        protein: number;
        fat: number;
    }[];
}

const mockFoodsDatabase: MockFood[] = [
    {
        id: "m_1",
        name: "Banana",
        description: "Per 1 medium (118g) - Calories: 105kcal | Fat: 0.39g | Carbs: 26.95g | Protein: 1.29g",
        brand: null,
        servings: [
            { id: "s_1_1", description: "1 medium", metricAmount: "118.0", metricUnit: "g", calories: 105, carbohydrates: 26.95, protein: 1.29, fat: 0.39 },
            { id: "s_1_2", description: "100 g", metricAmount: "100.0", metricUnit: "g", calories: 89, carbohydrates: 22.84, protein: 1.09, fat: 0.33 }
        ]
    },
    {
        id: "m_2",
        name: "Pechuga de Pollo",
        description: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0g | Protein: 31.02g",
        brand: "Genérico",
        servings: [
            { id: "s_2_1", description: "100 g", metricAmount: "100.0", metricUnit: "g", calories: 165, carbohydrates: 0, protein: 31.02, fat: 3.57 },
            { id: "s_2_2", description: "1 pechuga mediana", metricAmount: "150.0", metricUnit: "g", calories: 248, carbohydrates: 0, protein: 46.5, fat: 5.3 }
        ]
    },
    {
        id: "m_3",
        name: "Huevo Entero",
        description: "Per 1 large (50g) - Calories: 72kcal | Fat: 4.75g | Carbs: 0.36g | Protein: 6.28g",
        brand: null,
        servings: [
            { id: "s_3_1", description: "1 grande", metricAmount: "50.0", metricUnit: "g", calories: 72, carbohydrates: 0.36, protein: 6.28, fat: 4.75 },
            { id: "s_3_2", description: "100 g", metricAmount: "100.0", metricUnit: "g", calories: 143, carbohydrates: 0.72, protein: 12.56, fat: 9.51 }
        ]
    },
    {
        id: "m_4",
        name: "Arroz Integral",
        description: "Per 100g (cocido) - Calories: 111kcal | Fat: 0.9g | Carbs: 22.78g | Protein: 2.58g",
        brand: null,
        servings: [
            { id: "s_4_1", description: "100 g cocido", metricAmount: "100.0", metricUnit: "g", calories: 111, carbohydrates: 22.78, protein: 2.58, fat: 0.9 },
            { id: "s_4_2", description: "1 taza", metricAmount: "195.0", metricUnit: "g", calories: 216, carbohydrates: 44.4, protein: 5.03, fat: 1.76 }
        ]
    },
    {
        id: "m_5",
        name: "Avena",
        description: "Per 100g (cruda) - Calories: 389kcal | Fat: 6.9g | Carbs: 66.27g | Protein: 16.89g",
        brand: "Quaker",
        servings: [
            { id: "s_5_1", description: "100 g", metricAmount: "100.0", metricUnit: "g", calories: 389, carbohydrates: 66.27, protein: 16.89, fat: 6.9 },
            { id: "s_5_2", description: "1/2 taza", metricAmount: "40.0", metricUnit: "g", calories: 156, carbohydrates: 26.51, protein: 6.76, fat: 2.76 }
        ]
    },
    {
        id: "m_6",
        name: "Manzana",
        description: "Per 1 medium (182g) - Calories: 95kcal | Fat: 0.31g | Carbs: 25.13g | Protein: 0.47g",
        brand: null,
        servings: [
            { id: "s_6_1", description: "1 mediana", metricAmount: "182.0", metricUnit: "g", calories: 95, carbohydrates: 25.13, protein: 0.47, fat: 0.31 }
        ]
    },
    {
        id: "m_7",
        name: "Proteína Whey",
        description: "Per 1 scoop (30g) - Calories: 120kcal | Fat: 1.5g | Carbs: 3g | Protein: 24g",
        brand: "Optimum Nutrition",
        servings: [
            { id: "s_7_1", description: "1 scoop", metricAmount: "30.0", metricUnit: "g", calories: 120, carbohydrates: 3.0, protein: 24.0, fat: 1.5 }
        ]
    }
];

export async function searchFoods(query: string, pageNumber: number = 0) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const lowercaseQuery = query.toLowerCase();
    const results = mockFoodsDatabase.filter(food =>
        food.name.toLowerCase().includes(lowercaseQuery) ||
        (food.brand && food.brand.toLowerCase().includes(lowercaseQuery))
    );

    // Format like FatSecret's payload exactly
    return {
        foods: {
            food: results.map(r => ({
                food_id: r.id,
                food_name: r.name,
                food_description: r.description,
                brand_name: r.brand
            })),
            page_number: pageNumber,
            total_results: results.length
        }
    };
}

export async function getFoodDetails(foodId: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const food = mockFoodsDatabase.find(f => f.id === foodId);

    if (!food) {
        return { error: { message: "Food not found" } };
    }

    // Format like FatSecret's detailed payload exactly
    return {
        food: {
            food_id: food.id,
            food_name: food.name,
            brand_name: food.brand,
            servings: {
                serving: food.servings.map(s => ({
                    serving_id: s.id,
                    serving_description: s.description,
                    metric_serving_amount: s.metricAmount,
                    metric_serving_unit: s.metricUnit,
                    calories: String(s.calories),
                    carbohydrate: String(s.carbohydrates),
                    protein: String(s.protein),
                    fat: String(s.fat)
                }))
            }
        }
    };
}
