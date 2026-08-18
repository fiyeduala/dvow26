import { WEDDING } from "@/lib/invite";

export type InvitationCardInput = {
  guestName: string;
  seats: number;
  tableAssignment?: string | null;
  ceremony: string;
  reception: string;
  dressCode: string;
};

const WIDTH = 1240;
const MIN_HEIGHT = 1754;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paint(ctx: CanvasRenderingContext2D, input: InvitationCardInput, HEIGHT: number): number {
  const serif = '"Cormorant Garamond", Georgia, serif';
  const sans = '"Karla", system-ui, sans-serif';
  const gold = "#d9b45b";
  const lilac = "#c39ede";
  const cream = "#f4eee7";

  ctx.fillStyle = "#0b0710";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.32, 40, WIDTH / 2, HEIGHT * 0.32, WIDTH * 0.8);
  glow.addColorStop(0, "rgba(150, 90, 190, 0.28)");
  glow.addColorStop(1, "rgba(11, 7, 16, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, WIDTH - 112, HEIGHT - 112);
  ctx.strokeStyle = "rgba(195, 158, 222, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(78, 78, WIDTH - 156, HEIGHT - 156);

  ctx.textAlign = "center";
  let y = 210;

  const rule = (width: number, atY: number) => {
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - width / 2, atY);
    ctx.lineTo(WIDTH / 2 + width / 2, atY);
    ctx.stroke();
  };

  ctx.fillStyle = gold;
  ctx.font = `28px ${sans}`;
  ctx.fillText(WEDDING.families.join("  ·  ").toUpperCase(), WIDTH / 2, y);
  y += 60;

  ctx.fillStyle = "rgba(244, 238, 231, 0.72)";
  ctx.font = `italic 30px ${serif}`;
  for (const line of wrap(ctx, WEDDING.greeting, WIDTH - 320)) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 44;
  }

  y += 24;
  rule(180, y);
  y += 70;

  ctx.fillStyle = gold;
  ctx.font = `26px ${sans}`;
  ctx.fillText("THE WEDDING OF", WIDTH / 2, y);
  y += 80;

  ctx.fillStyle = cream;
  ctx.font = `72px ${serif}`;
  for (const line of wrap(ctx, WEDDING.brideFullName, WIDTH - 220)) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 84;
  }
  ctx.fillStyle = lilac;
  ctx.font = `56px ${serif}`;
  ctx.fillText("&", WIDTH / 2, y + 10);
  y += 90;
  ctx.fillStyle = cream;
  ctx.font = `72px ${serif}`;
  for (const line of wrap(ctx, WEDDING.groomFullName, WIDTH - 220)) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 84;
  }

  y += 20;
  ctx.fillStyle = lilac;
  ctx.font = `30px ${sans}`;
  ctx.fillText(WEDDING.hashtag, WIDTH / 2, y);
  y += 60;

  ctx.fillStyle = "rgba(244, 238, 231, 0.85)";
  ctx.font = `36px ${serif}`;
  ctx.fillText(WEDDING.date, WIDTH / 2, y);

  y += 80;
  rule(300, y);
  y += 80;

  ctx.fillStyle = gold;
  ctx.font = `26px ${sans}`;
  ctx.fillText("RESERVED FOR", WIDTH / 2, y);
  y += 72;
  ctx.fillStyle = cream;
  ctx.font = `62px ${serif}`;
  for (const line of wrap(ctx, input.guestName, WIDTH - 240)) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 74;
  }

  ctx.fillStyle = "rgba(244, 238, 231, 0.7)";
  ctx.font = `30px ${sans}`;
  const seatLine = `${input.seats} ${input.seats === 1 ? "seat" : "seats"} reserved${
    input.tableAssignment ? `  ·  ${input.tableAssignment}` : ""
  }`;
  ctx.fillText(seatLine, WIDTH / 2, y + 8);
  y += 90;

  const detail = (label: string, value: string) => {
    ctx.fillStyle = gold;
    ctx.font = `24px ${sans}`;
    ctx.fillText(label.toUpperCase(), WIDTH / 2, y);
    y += 42;
    ctx.fillStyle = "rgba(244, 238, 231, 0.9)";
    ctx.font = `30px ${serif}`;
    for (const line of wrap(ctx, value, WIDTH - 280)) {
      ctx.fillText(line, WIDTH / 2, y);
      y += 40;
    }
    y += 34;
  };

  detail("Ceremony", input.ceremony);
  detail("Reception", input.reception);
  detail("Dress code", input.dressCode);

  ctx.fillStyle = "rgba(217, 180, 91, 0.85)";
  ctx.font = `26px ${sans}`;
  ctx.fillText("Please present this invitation on arrival", WIDTH / 2, HEIGHT - 110);

  return y;
}

function measuringContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy(ctx, {
    get(target, prop, receiver) {
      if (prop === "createRadialGradient") return () => ({ addColorStop: noop });
      if (["fillText", "fillRect", "strokeRect", "stroke", "beginPath", "moveTo", "lineTo"].includes(String(prop))) {
        return noop;
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, prop, value) {
      Reflect.set(target, prop, value);
      return true;
    },
  }) as CanvasRenderingContext2D;
}

export async function downloadInvitationCard(input: InvitationCardInput) {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts are optional */
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = MIN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't generate the invitation image.");

  const contentBottom = paint(measuringContext(ctx), input, MIN_HEIGHT);
  const height = Math.max(MIN_HEIGHT, Math.round(contentBottom + 220));
  canvas.height = height;
  const drawCtx = canvas.getContext("2d");
  if (!drawCtx) throw new Error("Your browser can't generate the invitation image.");
  paint(drawCtx, input, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The invitation image could not be created.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = input.guestName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  link.href = url;
  link.download = `DVow2026-Invitation-${safeName || "Guest"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
