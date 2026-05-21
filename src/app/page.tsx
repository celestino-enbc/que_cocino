"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@/types/recipe";

type AppState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; recipe: Recipe }
  | { status: "error"; message: string };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const LOADING_MESSAGES = [
  "Analizando ingredientes...",
  "Pensando una receta...",
] as const;

function Spinner() {
  return (
    <svg
      className="h-10 w-10 animate-spin text-neutral-900 dark:text-neutral-100"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("No se pudo leer la imagen."));
        return;
      }

      const commaIndex = result.indexOf(",");
      const base64 =
        commaIndex >= 0 ? result.slice(commaIndex + 1) : result;

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen."));
    };

    reader.readAsDataURL(file);
  });
}

function isRecipe(value: unknown): value is Recipe {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === "string" &&
    typeof candidate.time === "string" &&
    Array.isArray(candidate.steps) &&
    candidate.steps.every((step) => typeof step === "string")
  );
}

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>({ status: "idle" });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (appState.status !== "loading") {
      return;
    }

    setLoadingMessageIndex(0);

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
      );
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [appState.status]);

  const resetToIdle = useCallback(() => {
    setAppState({ status: "idle" });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setAppState({
          status: "error",
          message: "Selecciona una imagen válida (JPG, PNG, etc.).",
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setAppState({
          status: "error",
          message: "La imagen es demasiado grande. Usa una de menos de 5 MB.",
        });
        return;
      }

      setAppState({ status: "loading" });

      try {
        const base64 = await readFileAsBase64(file);

        const response = await fetch("/api/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        const data: unknown = await response.json();

        if (!response.ok) {
          const errorMessage =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "No pude identificar ingredientes. Intenta con mejor luz.";

          setAppState({ status: "error", message: errorMessage });
          return;
        }

        if (!isRecipe(data)) {
          setAppState({
            status: "error",
            message: "No pude identificar ingredientes. Intenta con mejor luz.",
          });
          return;
        }

        setAppState({ status: "success", recipe: data });
      } catch {
        setAppState({
          status: "error",
          message:
            "No hay conexión o el servidor no respondió. Revisa tu red e intenta de nuevo.",
        });
      }
    },
    [],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5">
      <header className="pt-6 pb-8 text-center">
        <h1 className="text-2xl font-medium tracking-tight">¿Qué cocino?</h1>
        {appState.status === "idle" && (
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Foto tus ingredientes y te sugiero una receta rápida.
          </p>
        )}
      </header>

      <section className="flex flex-1 flex-col justify-center pb-8">
        {appState.status === "idle" && (
          <label
            htmlFor="ingredient-photo"
            className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-neutral-900 px-6 py-4 text-center text-base font-medium text-neutral-50 transition-all duration-200 active:scale-[0.98] focus-within:outline-none focus-within:ring-2 focus-within:ring-neutral-900 focus-within:ring-offset-2 focus-within:ring-offset-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 dark:focus-within:ring-neutral-100 dark:focus-within:ring-offset-neutral-950"
          >
            Tomar foto de ingredientes
            <input
              ref={fileInputRef}
              id="ingredient-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleImageUpload}
            />
          </label>
        )}

        {appState.status === "loading" && (
          <div
            className="flex flex-col items-center gap-4 text-center"
            role="status"
            aria-live="polite"
          >
            <Spinner />
            <p className="text-sm text-neutral-600 transition-opacity duration-300 dark:text-neutral-400">
              {LOADING_MESSAGES[loadingMessageIndex]}
            </p>
          </div>
        )}

        {appState.status === "success" && (
          <article className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-2xl font-medium leading-tight">
              {appState.recipe.title}
            </h2>
            <span className="mt-3 inline-block rounded-full bg-neutral-900 px-3 py-1 text-sm text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900">
              ⏱ {appState.recipe.time}
            </span>
            <ol className="mt-5 list-disc space-y-3 pl-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {appState.recipe.steps.map((step, index) => (
                <li key={`${index}-${step.slice(0, 12)}`}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={resetToIdle}
              className="mt-6 w-full rounded-2xl border border-neutral-300 px-6 py-3 text-base font-medium text-neutral-900 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:focus:ring-neutral-100 dark:focus:ring-offset-neutral-950"
            >
              Probar otra foto
            </button>
          </article>
        )}

        {appState.status === "error" && (
          <div className="text-center">
            <p className="text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
              {appState.message}
            </p>
            <button
              type="button"
              onClick={resetToIdle}
              className="mt-6 w-full rounded-2xl bg-neutral-900 px-6 py-4 text-base font-medium text-neutral-50 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 dark:focus:ring-neutral-100 dark:focus:ring-offset-neutral-950"
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
