import type { FormEvent } from "react";
import { Cat } from "lucide-react";

type AuthMode = "login" | "register";

type AuthScreenProps = {
  mode: AuthMode;
  error: string;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthScreen({
  mode,
  error,
  onModeChange,
  onSubmit,
}: AuthScreenProps) {
  return (
    <main className="mx-auto mt-20 max-w-md rounded-2xl border border-emerald-800 bg-emerald-950/60 p-8 shadow-lg shadow-lime-950/20">
      <Cat className="mb-3 text-lime-400" size={42} />
      <h1 className="text-3xl font-bold">Turbo Fi</h1>
      <p className="mb-6 text-emerald-200">
        Thoughtful household finance, with a little Turbo energy.
      </p>
      <form className="space-y-3" onSubmit={onSubmit}>
        {mode === "register" && (
          <input required name="householdName" placeholder="Household name" />
        )}
        <input required name="email" type="email" placeholder="Email" />
        <input
          required
          name="password"
          minLength={10}
          type="password"
          placeholder="Password (10+ characters)"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="w-full" type="submit">
          {mode === "register" ? "Create household" : "Sign in"}
        </button>
      </form>
      <button
        className="mt-4 w-full bg-transparent text-lime-300 hover:bg-emerald-900/60"
        onClick={() => onModeChange(mode === "register" ? "login" : "register")}
      >
        {mode === "register"
          ? "Already have an invitation? Sign in"
          : "Need to create the first household?"}
      </button>
    </main>
  );
}
