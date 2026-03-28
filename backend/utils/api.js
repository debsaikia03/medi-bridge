import axios from "axios";

// 🔹 FatSecret API Credential
const CLIENT_ID = "437d3dc2ee1d4ab0bde5d5783e40aa7b";
const CLIENT_SECRET = "fba82038c9ca4efea5ea546fc32dda21";

let fatsecretToken = null;
let tokenExpiry = 0;

// 🔹 Helper: Authenticate with FatSecret API using OAuth 2.0
const getFatsecretToken = async () => {
  if (fatsecretToken && Date.now() < tokenExpiry) {
    return fatsecretToken;
  }
  
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  try {
    // Use URLSearchParams to guarantee perfect x-www-form-urlencoded formatting
    const authData = new URLSearchParams();
    authData.append('grant_type', 'client_credentials');
    authData.append('scope', 'basic'); // Reverted to just 'basic' to prevent scope rejection on free tiers

    const response = await axios.post(
      'https://oauth.fatsecret.com/connect/token',
      authData,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    fatsecretToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
    return fatsecretToken;
    
  } catch (error) {
    // Unmask the exact error sent by FatSecret's server
    const errorDetails = error.response?.data 
      ? JSON.stringify(error.response.data) 
      : error.message;
      
    console.error("🚨 FatSecret OAuth Error Details:", errorDetails);
    throw new Error(`FatSecret Auth Error: ${errorDetails}`);
  }
};

// 🔹 Get Food Info (Using FatSecret API)
export const getFoodInfo = async (foodName, barcode) => {
  if (!foodName && !barcode) {
    throw new Error("Either provide the food name or barcode");
  }

  try {
    const token = await getFatsecretToken();
    
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    let foodId;

    if (barcode) {
      // Find Food ID by Barcode using URLSearchParams
      const data = new URLSearchParams({ method: 'food.find_id_for_barcode', barcode, format: 'json' });
      const res = await axios.post('https://platform.fatsecret.com/rest/server.api', data, { headers });
      
      if (res.data?.error) throw new Error(`FatSecret API Error: ${res.data.error.message}`);
      
      if (res.data && res.data.food_id && res.data.food_id.value) {
        foodId = res.data.food_id.value;
      } else {
        throw new Error("No product found with the provided barcode");
      }
    } else if (foodName) {
      // Find Food ID by Name using URLSearchParams
      const data = new URLSearchParams({ method: 'foods.search', search_expression: foodName, format: 'json', max_results: 1 });
      const res = await axios.post('https://platform.fatsecret.com/rest/server.api', data, { headers });
      
      // Explicitly catch and bubble FatSecret API errors so you know if it's an API rejection
      if (res.data?.error) throw new Error(`FatSecret API Error: ${res.data.error.message}`);
      
      const foodsInfo = res.data.foods?.food;
      if (!foodsInfo) throw new Error(`No product found matching "${foodName}"`);
      
      const firstFood = Array.isArray(foodsInfo) ? foodsInfo[0] : foodsInfo;
      if (!firstFood || !firstFood.food_id) throw new Error(`No product found matching "${foodName}"`);
      
      foodId = firstFood.food_id;
    }

    if (!foodId) throw new Error("No product found");

    // Fetch Full Nutritional Information using Food ID
    const foodData = new URLSearchParams({ method: 'food.get.v3', food_id: foodId, format: 'json' });
    const foodRes = await axios.post('https://platform.fatsecret.com/rest/server.api', foodData, { headers });

    if (foodRes.data?.error) throw new Error(`FatSecret API Error: ${foodRes.data.error.message}`);

    const product = foodRes.data.food;
    if (!product) throw new Error("No product details found");

    // Extract Serving details
    const servingsRaw = product.servings?.serving;
    const servings = Array.isArray(servingsRaw) ? servingsRaw : (servingsRaw ? [servingsRaw] : []);
    
    // Default to a 100g serving if available, otherwise just use the first available serving
    let serving = servings.find(s => s.metric_serving_amount === '100.000' && s.metric_serving_unit === 'g') || servings[0];

    if (!serving) throw new Error("No nutritional information found for this item");

    let scale = 1;
    if (serving.metric_serving_amount) {
      if (serving.metric_serving_unit === 'g' || serving.metric_serving_unit === 'ml') {
        scale = 100 / parseFloat(serving.metric_serving_amount);
      }
    }

    const parseNutrient = (val) => val ? parseFloat(val) * scale : 0;
    const formatValue = (val) => parseFloat(val.toFixed(2));

    const nutrition = {
      energy_unit: 'kcal',
      energy_100g: formatValue(parseNutrient(serving.calories)),
      proteins_100g: formatValue(parseNutrient(serving.protein)),
      fiber_100g: formatValue(parseNutrient(serving.fiber)),
      fat_100g: formatValue(parseNutrient(serving.fat)),
      "saturated-fat_100g": formatValue(parseNutrient(serving.saturated_fat)),
      sugars_100g: formatValue(parseNutrient(serving.sugar)),
      sodium_100g: formatValue(parseNutrient(serving.sodium) / 1000), 
      salt_100g: formatValue((parseNutrient(serving.sodium) / 1000) * 2.54), 
      carbohydrates_100g: formatValue(parseNutrient(serving.carbohydrate)),
      cholesterol_100g: formatValue(parseNutrient(serving.cholesterol)) 
    };

    return {
      name: product.food_name || "Unknown",
      ingredients: product.ingredients || "Not available",
      nutrition: nutrition,
      barcode: barcode || "Not available",
      image: "No image available",
      allergens: [], 
      categories: [product.food_type].filter(Boolean),
      brands: product.brand_name || "Not available",
      labels: [],
      quantity: serving.serving_description || "Not available",
    };

  } catch (error) {
    throw new Error(error.message || "Error while fetching food information");
  }
};

// 🔹 Calculate Health Score (No changes)
export const calculateHealthScore = async (userMetrics, foodName, barcode) => {
  if (!foodName && !barcode) {
    throw new Error("Provide either foodName or barcode as query parameter");
  }

  const foodInfo = await getFoodInfo(foodName, barcode);

  const heightInMeters = userMetrics.height / 100;
  const bmi = userMetrics.weight / (heightInMeters * heightInMeters);

  const nutriments = foodInfo.nutrition || {};
  const fat = nutriments["fat_100g"] ?? 0;
  const saturatedFat = nutriments["saturated-fat_100g"] ?? 0;
  const sugars = nutriments["sugars_100g"] ?? 0;
  const fiber = nutriments["fiber_100g"] ?? 0;
  const proteins = nutriments["proteins_100g"] ?? 0;
  const salt = nutriments["salt_100g"] ?? 0;

  let score = 100;

  if (bmi < 18.5) score -= 10;
  else if (bmi > 25) score -= 10;

  if (fat > 20) score -= 10;
  if (saturatedFat > 10) score -= 10;
  if (sugars > 15) score -= 10;
  if (fiber < 3) score -= 5;
  if (proteins < 5) score -= 5;
  if (salt > 1.5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let grade = "E";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";

  let advice = "";
  if (score >= 80) advice = "Good nutritional profile.";
  else if (score >= 60) advice = "Moderate nutritional content; watch fats and sugars.";
  else advice = "Poor nutritional content; consider healthier options.";

  return {
    score,
    grade,
    advice,
    bmi: parseFloat(bmi.toFixed(2)),
    foodName: foodInfo.name,
  };
};

// 🔹 Check Dietary Compatibility (No changes)
export const checkDietaryCompatibility = async (foodName, barcode, dietType) => {
  if (!dietType) throw new Error("dietType is required (e.g., vegan, gluten-free)");
  if (!foodName && !barcode) throw new Error("Provide either foodName or barcode");

  const foodInfo = await getFoodInfo(foodName, barcode);

  const ingredientsText = (foodInfo.ingredients || "").toLowerCase();
  const allergens = (foodInfo.allergens || []).map((a) => a.toLowerCase());
  const labels = (foodInfo.labels || []).map((l) => l.toLowerCase());

  const dietExclusions = {
    vegan: ["milk", "egg", "meat", "honey", "gelatin", "cheese", "butter", "yogurt"],
    "gluten-free": ["wheat", "barley", "rye", "malt", "triticale"],
  };

  const exclusions = dietExclusions[dietType.toLowerCase()];
  if (!exclusions) {
    throw new Error(`Unsupported dietType: ${dietType}. Supported: vegan, gluten-free`);
  }

  const issues = [];
  exclusions.forEach((exclusion) => {
    if (
      ingredientsText.includes(exclusion) ||
      allergens.includes(exclusion) ||
      labels.includes(exclusion)
    ) {
      issues.push(exclusion);
    }
  });

  return {
    isCompatible: issues.length === 0,
    issues,
    dietType,
  };
};
