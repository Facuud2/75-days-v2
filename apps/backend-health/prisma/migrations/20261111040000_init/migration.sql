-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "UserHealthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyCalorieGoal" INTEGER NOT NULL DEFAULT 2000,
    "proteinGoalG" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "carbGoalG" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "fatGoalG" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "heightCm" DOUBLE PRECISION NOT NULL DEFAULT 170,
    "stravaAccessToken" TEXT,
    "stravaRefreshToken" TEXT,
    "stravaTokenExpiresAt" INTEGER,
    "stravaAthleteId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserHealthProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "intensity" TEXT NOT NULL,
    "caloriesBurned" DOUBLE PRECISION NOT NULL,
    "isManualCalories" BOOLEAN NOT NULL DEFAULT false,
    "distanceKm" DOUBLE PRECISION,
    "loadVolumeKg" DOUBLE PRECISION,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "caloriesPer100g" DOUBLE PRECISION NOT NULL,
    "proteinPer100g" DOUBLE PRECISION NOT NULL,
    "carbPer100g" DOUBLE PRECISION NOT NULL,
    "fatPer100g" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "servingSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFoodIngredient" (
    "id" TEXT NOT NULL,
    "customFoodId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "weightGrams" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CustomFoodIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserHealthProfile_userId_key" ON "UserHealthProfile"("userId");

-- CreateIndex
CREATE INDEX "MealEntry_userId_date_idx" ON "MealEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutEntry_externalId_key" ON "WorkoutEntry"("externalId");

-- CreateIndex
CREATE INDEX "WorkoutEntry_userId_date_idx" ON "WorkoutEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "CustomFood_userId_idx" ON "CustomFood"("userId");

-- CreateIndex
CREATE INDEX "CustomFoodIngredient_customFoodId_idx" ON "CustomFoodIngredient"("customFoodId");

-- CreateIndex
CREATE INDEX "CustomFoodIngredient_ingredientId_idx" ON "CustomFoodIngredient"("ingredientId");

-- AddForeignKey
ALTER TABLE "CustomFoodIngredient" ADD CONSTRAINT "CustomFoodIngredient_customFoodId_fkey" FOREIGN KEY ("customFoodId") REFERENCES "CustomFood"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFoodIngredient" ADD CONSTRAINT "CustomFoodIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

