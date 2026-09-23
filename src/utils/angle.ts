// ============================================================
// 角度工具：实现文档 4.3 节的 Click Wheel 手势算法
//
// delta = normalizeAngle(currentAngle - previousAngle)
// accumulator += delta
// while abs(accumulator) >= stepAngle:
//   selection += sign(accumulator)
//   accumulator -= sign(accumulator) * stepAngle
// ============================================================

const TAU = Math.PI * 2;

/** 把角度规整到 (-PI, PI]，用于处理跨越 ±180° 的差值 */
export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

/** 由触点相对圆心的角度（弧度，0 在 12 点钟方向，顺时针为正） */
export function angleFromCenter(
  x: number,
  y: number,
  cx: number,
  cy: number,
): number {
  // atan2 默认 0 在 3 点钟方向、顺时针为负；转换为 12 点钟 + 顺时针为正
  const raw = Math.atan2(y - cy, x - cx);
  // 顺时针为正：0 点钟（向上）= -PI/2 -> 加 PI/2 后为 0
  const clock = raw + PI / 2;
  return normalizeAngle(clock);
}

const PI = Math.PI;

export interface WheelAccumulator {
  /** 每步角度阈值，默认 20° */
  stepAngle: number;
  /** 累积角度（度） */
  accumulator: number;
}

export function createAccumulator(stepDeg = 20): WheelAccumulator {
  return { stepAngle: stepDeg, accumulator: 0 };
}

/**
 * 把新的角度增量喂入累加器，返回本次产生的「步数」（含方向）
 * 单位：调用方传入的是弧度
 */
export function feedWheel(
  acc: WheelAccumulator,
  deltaRad: number,
): number {
  const stepRad = (acc.stepAngle * Math.PI) / 180;
  acc.accumulator += deltaRad;
  let steps = 0;
  // 防止快速滑动时单次事件跳过多项：单次最多 ±8 步
  const MAX_STEPS_PER_EVENT = 8;
  while (Math.abs(acc.accumulator) >= stepRad && Math.abs(steps) < MAX_STEPS_PER_EVENT) {
    steps += Math.sign(acc.accumulator);
    acc.accumulator -= Math.sign(acc.accumulator) * stepRad;
  }
  // 限幅后剩余角度丢弃，避免越界累积
  if (Math.abs(steps) >= MAX_STEPS_PER_EVENT) {
    acc.accumulator = 0;
  }
  return steps;
}

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;