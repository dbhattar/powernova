export const name = "square";

export function draw(ctx, length, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, length, length);

  return { length, x, y, color };
}

export function reportArea(r) {
    return Math.PI * r * r;
}

export function reportPerimeter(r) {
    return 2 * Math.PI * r;
}