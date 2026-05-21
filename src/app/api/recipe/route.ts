import { NextRequest, NextResponse } from "next/server";
import type { Recipe } from "@/types/recipe";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  'Eres un asistente culinario. Analiza la foto que recibirás y identifica máximo 3 ingredientes principales visibles. Sugiere EXACTAMENTE UNA receta rápida (máximo 30 minutos) que se pueda preparar con esos ingredientes. Asume que el usuario tiene en casa: sal, pimienta, aceite, agua, ajo y cebolla. Responde ESTRICTAMENTE en JSON válido con esta estructura exacta: { "title": string, "time": string (formato: "X min"), "steps": string[] (entre 3 y 6 pasos cortos y accionables) }. No incluyas texto fuera del JSON.';

const REQUEST_TIMEOUT_MS = 30_000;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function isRecipe(value: unknown): value is Recipe {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    typeof candidate.time === "string" &&
    candidate.time.trim().length > 0 &&
    Array.isArray(candidate.steps) &&
    candidate.steps.length >= 3 &&
    candidate.steps.length <= 6 &&
    candidate.steps.every((step) => typeof step === "string" && step.trim().length > 0)
  );
}

function normalizeBase64Image(image: string): string {
  const trimmed = image.trim();

  if (trimmed.startsWith("data:")) {
    const commaIndex = trimmed.indexOf(",");
    return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
  }

  return trimmed;
}

function getEnvOrError(): { apiKey: string; apiUrl: string; model: string } | NextResponse {
  const apiKey = process.env.IA_API_KEY?.trim();
  const apiUrl = process.env.IA_API_URL?.trim();
  const model = process.env.IA_MODEL?.trim();

  if (!apiKey || !apiUrl || !model) {
    return NextResponse.json(
      { error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

  return { apiKey, apiUrl, model };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("image" in body) ||
    typeof (body as { image: unknown }).image !== "string" ||
    (body as { image: string }).image.trim().length === 0
  ) {
    return NextResponse.json({ error: "Imagen requerida." }, { status: 400 });
  }

  const { image: rawImage } = body as { image: string };
  const env = getEnvOrError();

  if (env instanceof NextResponse) {
    return env;
  }

  const { apiKey, apiUrl, model } = env;
  const image = normalizeBase64Image(rawImage);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const iaResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analiza esta foto de ingredientes." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!iaResponse.ok) {
      return NextResponse.json(
        { error: "No pude generar una receta. Intenta de nuevo." },
        { status: 500 },
      );
    }

    const data = (await iaResponse.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No pude identificar ingredientes. Intenta con mejor luz." },
        { status: 500 },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "No pude identificar ingredientes. Intenta con mejor luz." },
        { status: 500 },
      );
    }

    if (!isRecipe(parsed)) {
      return NextResponse.json(
        { error: "No pude identificar ingredientes. Intenta con mejor luz." },
        { status: 500 },
      );
    }

    const recipe: Recipe = {
      title: parsed.title.trim(),
      time: parsed.time.trim(),
      steps: parsed.steps.map((step) => step.trim()),
    };

    return NextResponse.json(recipe);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "La solicitud tardó demasiado. Intenta de nuevo." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "No pude identificar ingredientes. Intenta con mejor luz." },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
