/**
 * Gemini AI Integration for Quiz Generation and Validation
 *
 * This module provides integration with Google's Gemini AI for generating
 * quiz questions and validating quiz answers.
 *
 * Required environment variables:
 * - GEMINI_API_KEY: Your Google AI Studio API key
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  explanation?: string;
}

interface GenerateQuizOptions {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  category?: string;
}

interface ValidateAnswerOptions {
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

/**
 * Generate quiz questions using Gemini AI
 */
export async function generateQuizQuestions(
  options: GenerateQuizOptions
): Promise<{ success: boolean; questions?: QuizQuestion[]; error?: string }> {
  if (!isGeminiConfigured()) {
    return { success: false, error: "Gemini AI not configured" };
  }

  const { topic, difficulty, questionCount, category } = options;

  const prompt = `Generate ${questionCount} multiple-choice quiz questions about "${topic}"${category ? ` in the ${category} category` : ""}.

Difficulty level: ${difficulty}

Requirements:
- Each question should have exactly 4 options (A, B, C, D)
- Only one option should be correct
- Questions should be clear and educational
- Provide a brief explanation for the correct answer

Return the response in the following JSON format only (no markdown, no code blocks, just JSON):
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Important:
- correctAnswer should be the index (0-3) of the correct option
- Do not include any text before or after the JSON
- Ensure valid JSON formatting`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", error);
      return { success: false, error: "Failed to generate questions" };
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return { success: false, error: "Empty response from Gemini" };
    }

    // Parse the JSON response
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanJson = textContent.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      return { success: true, questions: parsed.questions };
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError, textContent);
      return { success: false, error: "Failed to parse quiz questions" };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Validate a user's answer with AI explanation
 */
export async function validateAnswerWithAI(
  options: ValidateAnswerOptions
): Promise<{
  success: boolean;
  isCorrect?: boolean;
  feedback?: string;
  error?: string;
}> {
  if (!isGeminiConfigured()) {
    return { success: false, error: "Gemini AI not configured" };
  }

  const { question, userAnswer, correctAnswer } = options;

  const prompt = `Evaluate this quiz answer:

Question: ${question}
User's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

Provide a brief evaluation in JSON format:
{
  "isCorrect": true or false,
  "feedback": "Brief feedback explaining why the answer is correct or incorrect"
}

Only return the JSON, no additional text.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to validate answer" };
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return { success: false, error: "Empty response from Gemini" };
    }

    try {
      let cleanJson = textContent.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      return {
        success: true,
        isCorrect: parsed.isCorrect,
        feedback: parsed.feedback,
      };
    } catch {
      // Fallback to simple comparison
      return {
        success: true,
        isCorrect: userAnswer.toLowerCase() === correctAnswer.toLowerCase(),
        feedback: "Answer evaluated",
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate quiz questions for a specific task
 */
export async function generateTaskQuiz(
  taskTitle: string,
  taskDescription: string,
  contentUrl?: string
): Promise<{ success: boolean; questions?: QuizQuestion[]; error?: string }> {
  if (!isGeminiConfigured()) {
    return { success: false, error: "Gemini AI not configured" };
  }

  const prompt = `Generate 5 multiple-choice quiz questions based on this task:

Title: ${taskTitle}
Description: ${taskDescription}
${contentUrl ? `Related content: ${contentUrl}` : ""}

Generate questions that test understanding of the task content.

Requirements:
- Each question should have exactly 4 options
- Only one option should be correct
- Questions should be relevant to the task

Return the response in JSON format only:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation"
    }
  ]
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to generate quiz" };
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return { success: false, error: "Empty response from Gemini" };
    }

    try {
      let cleanJson = textContent.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      return { success: true, questions: parsed.questions };
    } catch (parseError) {
      console.error("Error parsing quiz response:", parseError);
      return { success: false, error: "Failed to parse quiz" };
    }
  } catch (error) {
    console.error("Error generating task quiz:", error);
    return { success: false, error: String(error) };
  }
}
