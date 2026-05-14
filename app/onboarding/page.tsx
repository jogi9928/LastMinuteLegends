"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Flame,
  Activity,
  User,
  Dumbbell,
  Home,
  CircleDot,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { StepShell } from "@/components/onboarding/StepShell";
import { OptionCard } from "@/components/onboarding/OptionCard";
import { setOnboarding } from "@/lib/storage";
import type { OnboardingData } from "@/lib/types";

const TOTAL_STEPS = 9;

const COMMON_INJURIES = [
  "Lower back",
  "Knees",
  "Shoulders",
  "Wrists",
  "Hips",
  "Ankles",
  "Neck",
  "Elbows",
];

const DEFAULT: OnboardingData = {
  name: "",
  goal: "strength",
  avatar: "male",
  experienceYears: 2,
  intensity: "intermediate",
  age: 25,
  injuries: [],
  injuriesOther: "",
  equipment: "full_gym",
  daysPerWeek: 4,
  weightKg: 75,
  heightCm: 175,
  calibration: "bodyweight_squat",
  completedAt: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(DEFAULT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("lml.onboarding.draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        setData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("lml.onboarding.draft", JSON.stringify(data));
    } catch {}
  }, [data]);

  const progress = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 1) setStep(step - 1);
  }

  function finish() {
    const final: OnboardingData = { ...data, completedAt: new Date().toISOString() };
    setOnboarding(final);
    try {
      window.localStorage.removeItem("lml.onboarding.draft");
    } catch {}
    router.push("/dashboard");
  }

  const canAdvance = useMemo(() => {
    switch (step) {
      case 4:
        return data.age >= 13 && data.age <= 100;
      case 8:
        return data.weightKg > 30 && data.heightCm > 100;
      default:
        return true;
    }
  }, [step, data]);

  return (
    <main className="relative flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
      </div>

      <header className="mb-8 w-full max-w-xl space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span className="flex items-center gap-2 text-primary">
            <Sparkles className="h-3.5 w-3.5" /> LastMinuteLegends
          </span>
          <span>
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </header>

      {step === 1 ? <GoalStep data={data} update={update} /> : null}
      {step === 2 ? <AvatarStep data={data} update={update} /> : null}
      {step === 3 ? <ExperienceStep data={data} update={update} /> : null}
      {step === 4 ? <AgeStep data={data} update={update} /> : null}
      {step === 5 ? <InjuriesStep data={data} update={update} /> : null}
      {step === 6 ? <EquipmentStep data={data} update={update} /> : null}
      {step === 7 ? <FrequencyStep data={data} update={update} /> : null}
      {step === 8 ? <BaselineStep data={data} update={update} /> : null}
      {step === 9 ? <CalibrationStep data={data} update={update} /> : null}

      <div className="mt-8 flex w-full max-w-xl items-center justify-between gap-3">
        <Button variant="ghost" onClick={back} disabled={step === 1} size="lg">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={next} disabled={!canAdvance} size="lg" className="min-w-[8rem]">
          {step === TOTAL_STEPS ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}

type StepProps = {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
};

function GoalStep({ data, update }: StepProps) {
  return (
    <StepShell title="What's your goal?" description="We'll tune your program around the outcome that matters to you.">
      <div className="space-y-3">
        <OptionCard
          selected={data.goal === "aesthetics"}
          onClick={() => update("goal", "aesthetics")}
          icon={<Flame className="h-5 w-5" />}
          title="Aesthetics"
          subtitle="Build muscle, reduce body fat, look the part."
        />
        <OptionCard
          selected={data.goal === "strength"}
          onClick={() => update("goal", "strength")}
          icon={<Trophy className="h-5 w-5" />}
          title="Strength"
          subtitle="Move heavier weight. Compound-lift focused."
        />
        <OptionCard
          selected={data.goal === "general"}
          onClick={() => update("goal", "general")}
          icon={<Activity className="h-5 w-5" />}
          title="General fitness"
          subtitle="Stay healthy, mobile, and capable."
        />
      </div>
    </StepShell>
  );
}

function AvatarStep({ data, update }: StepProps) {
  return (
    <StepShell title="Pick your coach" description="Your HeyGen avatar will deliver feedback after each workout.">
      <div className="grid grid-cols-2 gap-3">
        {(["male", "female"] as const).map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => update("avatar", a)}
            className={
              "flex flex-col items-center gap-3 rounded-xl border p-6 transition-all hover:border-primary/60 hover:bg-primary/5 " +
              (data.avatar === a ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-card")
            }
          >
            <div
              className={
                "flex h-20 w-20 items-center justify-center rounded-full border-2 transition-colors " +
                (data.avatar === a ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground")
              }
            >
              <User className="h-10 w-10" />
            </div>
            <span className="text-base font-semibold capitalize">{a}</span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}

function ExperienceStep({ data, update }: StepProps) {
  return (
    <StepShell title="How long have you trained?" description="Roughly — we just need a feel for your background.">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm text-muted-foreground">Years lifting</Label>
          <span className="text-3xl font-semibold tabular-nums text-primary">
            {data.experienceYears}
            <span className="ml-1 text-sm text-muted-foreground">yr{data.experienceYears === 1 ? "" : "s"}</span>
          </span>
        </div>
        <Slider
          value={[data.experienceYears]}
          onValueChange={(v) => update("experienceYears", v[0])}
          min={0}
          max={20}
          step={1}
        />
      </div>

      <div className="space-y-3 pt-2">
        <Label className="text-sm text-muted-foreground">Self-assessed intensity</Label>
        <div className="grid gap-2">
          {(["beginner", "intermediate", "advanced"] as const).map((i) => (
            <OptionCard
              key={i}
              selected={data.intensity === i}
              onClick={() => update("intensity", i)}
              title={i.charAt(0).toUpperCase() + i.slice(1)}
              subtitle={
                i === "beginner"
                  ? "Still learning the lifts."
                  : i === "intermediate"
                  ? "Comfortable under the bar."
                  : "Programming around plateaus."
              }
            />
          ))}
        </div>
      </div>
    </StepShell>
  );
}

function AgeStep({ data, update }: StepProps) {
  return (
    <StepShell title="How old are you?" description="Used to calibrate recovery and intensity expectations.">
      <div className="flex items-end gap-4">
        <Input
          type="number"
          min={13}
          max={100}
          value={data.age}
          onChange={(e) => update("age", parseInt(e.target.value || "0", 10))}
          className="h-16 max-w-[8rem] text-3xl font-semibold tabular-nums"
        />
        <span className="pb-3 text-base text-muted-foreground">years old</span>
      </div>
    </StepShell>
  );
}

function InjuriesStep({ data, update }: StepProps) {
  function toggle(label: string) {
    const has = data.injuries.includes(label);
    update("injuries", has ? data.injuries.filter((i) => i !== label) : [...data.injuries, label]);
  }
  return (
    <StepShell title="Any injuries or mobility limits?" description="We'll flag exercises that load the affected areas.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {COMMON_INJURIES.map((inj) => (
          <button
            type="button"
            key={inj}
            onClick={() => toggle(inj)}
            className={
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all " +
              (data.injuries.includes(inj)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40")
            }
          >
            <Checkbox checked={data.injuries.includes(inj)} className="pointer-events-none" />
            {inj}
          </button>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <Label htmlFor="other-injury" className="text-sm text-muted-foreground">
          Anything else? (optional)
        </Label>
        <Textarea
          id="other-injury"
          placeholder="e.g. recovering from ACL surgery, limited overhead range…"
          value={data.injuriesOther}
          onChange={(e) => update("injuriesOther", e.target.value)}
          rows={3}
        />
      </div>
    </StepShell>
  );
}

function EquipmentStep({ data, update }: StepProps) {
  const options = [
    { value: "full_gym", title: "Full gym", subtitle: "Racks, bars, machines, cable stack.", icon: <Dumbbell className="h-5 w-5" /> },
    { value: "home_setup", title: "Home setup", subtitle: "Rack + barbell at home.", icon: <Home className="h-5 w-5" /> },
    { value: "dumbbells", title: "Dumbbells only", subtitle: "Adjustable or fixed DBs.", icon: <Dumbbell className="h-5 w-5" /> },
    { value: "bodyweight", title: "Bodyweight", subtitle: "No equipment needed.", icon: <Activity className="h-5 w-5" /> },
  ] as const;
  return (
    <StepShell title="What equipment can you use?" description="We'll only program exercises you can actually do.">
      <div className="space-y-2">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            selected={data.equipment === o.value}
            onClick={() => update("equipment", o.value)}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
          />
        ))}
      </div>
    </StepShell>
  );
}

function FrequencyStep({ data, update }: StepProps) {
  return (
    <StepShell title="How many days per week?" description="Be honest — consistency beats ambition.">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm text-muted-foreground">Training days</Label>
          <span className="text-4xl font-semibold tabular-nums text-primary">
            {data.daysPerWeek}
            <span className="ml-1 text-sm text-muted-foreground">/ wk</span>
          </span>
        </div>
        <Slider
          value={[data.daysPerWeek]}
          onValueChange={(v) => update("daysPerWeek", v[0])}
          min={1}
          max={7}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </StepShell>
  );
}

function BaselineStep({ data, update }: StepProps) {
  return (
    <StepShell title="Baseline stats" description="We'll track progress relative to this starting point.">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="weight" className="text-sm text-muted-foreground">
            Body weight (kg)
          </Label>
          <Input
            id="weight"
            type="number"
            min={30}
            max={250}
            value={data.weightKg}
            onChange={(e) => update("weightKg", parseFloat(e.target.value || "0"))}
            className="h-12 text-lg tabular-nums"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height" className="text-sm text-muted-foreground">
            Height (cm)
          </Label>
          <Input
            id="height"
            type="number"
            min={100}
            max={230}
            value={data.heightCm}
            onChange={(e) => update("heightCm", parseFloat(e.target.value || "0"))}
            className="h-12 text-lg tabular-nums"
          />
        </div>
      </div>
    </StepShell>
  );
}

function CalibrationStep({ data, update }: StepProps) {
  return (
    <StepShell
      title="One last thing — calibration"
      description="Record a quick bodyweight movement so we can baseline your form. You'll do this on the next screen."
    >
      <div className="space-y-3">
        <OptionCard
          selected={data.calibration === "bodyweight_squat"}
          onClick={() => update("calibration", "bodyweight_squat")}
          title="Bodyweight squat"
          subtitle="3-5 controlled reps from a side angle."
          icon={<CircleDot className="h-5 w-5" />}
        />
        <OptionCard
          selected={data.calibration === "pushup"}
          onClick={() => update("calibration", "pushup")}
          title="Push-up"
          subtitle="3-5 strict push-ups from a side angle."
          icon={<CircleDot className="h-5 w-5" />}
        />
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <Camera className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <div className="font-medium">Camera placement tip</div>
          <div className="text-muted-foreground">
            Set your phone on the floor, leaned at ~75°, 6-8 ft away. Capture your full body in frame from the side.
          </div>
        </div>
      </div>
    </StepShell>
  );
}
