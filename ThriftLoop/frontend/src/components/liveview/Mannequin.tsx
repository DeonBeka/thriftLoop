import Svg, { ClipPath, Defs, Ellipse, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { measure, type Body, type GarmentKind } from '@/utils/fit';

export type View3 = 'front' | 'side' | 'back';

export interface Garment {
  kind: GarmentKind;
  /** 'T-shirts' | 'Hoodies' | 'Jackets' | 'Jeans' | 'Trousers' | ... */
  category: string;
  title: string;
  color: string;
  accent: string | null;
  ease: number;
  length: number;
}

interface Props {
  body: Body;
  view: View3;
  garment: Garment;
  skin: string;
  outline: string;
  label: string;
  width: number;
}

const VB_W = 240;
const VB_H = 440;
const GROUND = 430;
const PX_PER_CM = 2;
const CX = 120;

/** Darker/lighter shade of a #rrggbb colour. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

interface Level {
  y: number;
  half: number;
  offset: number; // centre shift (side view: chest forward, seat back)
}

/** A symmetric-ish outline through levels: left edge down, right edge up. */
function outlinePath(levels: Level[], neckHalf: number, neckY: number): string {
  const left = levels.map((l) => [CX + l.offset - l.half, l.y] as const);
  const right = [...levels].reverse().map((l) => [CX + l.offset + l.half, l.y] as const);
  let d = `M ${CX - neckHalf} ${neckY}`;
  const [l0] = left;
  d += ` Q ${l0[0] + (CX - neckHalf - l0[0]) * 0.25} ${neckY + 1} ${l0[0]} ${l0[1]}`;
  for (let i = 1; i < left.length; i++) {
    const [x0, y0] = left[i - 1];
    const [x1, y1] = left[i];
    d += ` Q ${(x0 + x1) / 2 - 1} ${(y0 + y1) / 2} ${x1} ${y1}`;
  }
  d += ` L ${right[0][0]} ${right[0][1]}`;
  for (let i = 1; i < right.length; i++) {
    const [x0, y0] = right[i - 1];
    const [x1, y1] = right[i];
    d += ` Q ${(x0 + x1) / 2 + 1} ${(y0 + y1) / 2} ${x1} ${y1}`;
  }
  const last = right[right.length - 1];
  d += ` Q ${last[0] - (last[0] - CX - neckHalf) * 0.25} ${neckY + 1} ${CX + neckHalf} ${neckY} Z`;
  return d;
}

export function Mannequin({ body, view, garment, skin, outline, label, width }: Props) {
  const m = measure(body);
  const H = body.heightCm * PX_PER_CM;
  const top = GROUND - H;
  const y = (f: number) => top + f * H;
  const side = view === 'side';
  const build = Math.sqrt(m.bmi / 22);

  // Half-widths in px: front width from circumference, or depth for the side view.
  const toHalf = (circ: number) => (side ? circ / 4.2 : circ / 3.05);
  const chest = toHalf(m.chest);
  const waist = toHalf(m.waist);
  const hips = toHalf(m.hips);
  const shoulders = side ? chest * 0.82 : chest * 1.2;
  const off = (front: number) => (side ? front : 0);

  const neckHalf = H * 0.024 * build;
  const headRx = H * (side ? 0.056 : 0.05);
  const headRy = H * 0.064;
  const armW = H * 0.04 * build;
  const thighW = (side ? hips * 1.25 : hips * 0.92);
  const calfW = thighW * 0.6;

  const torsoLevels: Level[] = [
    { y: y(0.19), half: shoulders, offset: off(1) },
    { y: y(0.25), half: chest, offset: off(3) },
    { y: y(0.4), half: waist, offset: off(2) },
    { y: y(0.5), half: hips, offset: off(-3) },
    { y: y(0.53), half: hips * 0.97, offset: off(-2) },
  ];
  const torso = outlinePath(torsoLevels, neckHalf, y(0.165));

  // Arms (front/back: both sides; side: one arm in front of the body).
  const arms: number[][][] = side
    ? [[[CX - 2, y(0.2)], [CX - 1, y(0.34)], [CX + 5, y(0.47)]]]
    : [-1, 1].map((s) => [
        [CX + s * (shoulders - armW * 0.45), y(0.205)],
        [CX + s * (chest + armW * 0.55 + 1), y(0.34)],
        [CX + s * (hips + armW * 0.45 + 2), y(0.475)],
      ]);
  const legs: number[][][] = side
    ? [[[CX - 2, y(0.5)], [CX, y(0.73)], [CX - 1, y(0.955)]]]
    : [-1, 1].map((s) => [
        [CX + s * hips * 0.5, y(0.5)],
        [CX + s * hips * 0.42, y(0.73)],
        [CX + s * hips * 0.36, y(0.955)],
      ]);

  const pts = (p: number[][]) => p.map(([px, py]) => `${px},${py}`).join(' ');
  const g = garment;
  const fill = g.color;
  const stroke = shade(fill, -0.18);
  const detail = shade(fill, fill === '#232323' ? 0.18 : -0.28);
  const striped = !!g.accent && /strip/i.test(g.title);
  const graphic = !!g.accent && /graphic|print/i.test(g.title);

  // ---------- garment geometry ----------
  const e = g.ease;
  const loose = (half: number) => Math.max(half + 1.5, half * e + 2);
  const isTee = g.category === 'T-shirts';
  const isHoodie = g.category === 'Hoodies';
  const isJacket = g.category === 'Jackets';
  const longSleeve = !isTee || /long-sleeve|long sleeve/i.test(g.title);
  const hemF = 0.4 + 0.12 * g.length + (isJacket ? 0.015 : 0);

  const topLevels: Level[] = [
    { y: y(0.185), half: loose(shoulders) + (isJacket ? 2 : 0), offset: off(1) },
    { y: y(0.25), half: loose(chest) + (isJacket ? 2 : 0), offset: off(3) },
    { y: y(0.4), half: loose(Math.max(waist, chest * 0.88)), offset: off(2) },
    { y: y(hemF), half: loose(Math.max(hips, waist)) + (isHoodie ? -1 : 1), offset: off(-1) },
  ];
  const topPath = outlinePath(topLevels, neckHalf + 2.5, y(0.163));
  const sleeveW = armW * (isJacket ? 1.55 : isHoodie ? 1.45 : 1.35) * Math.min(1.25, e);
  const sleeves = arms.map((a) =>
    longSleeve ? a : [a[0], [a[0][0] + (a[1][0] - a[0][0]) * 0.55, a[0][1] + (a[1][1] - a[0][1]) * 0.55]],
  );

  // Front/back: sleeves sit behind the torso edge. Side: the one visible arm is in front of the body.
  const sleeveShapes = (
    <G>
      {sleeves.map((s, i) => (
        <Polyline key={`sleeve${i}`} points={pts(s)} fill="none" stroke={fill} strokeWidth={sleeveW} strokeLinecap={longSleeve ? 'round' : 'butt'} strokeLinejoin="round" />
      ))}
      {side &&
        sleeves.map((s, i) => (
          <Polyline key={`sleeveEdge${i}`} points={pts(s)} fill="none" stroke={stroke} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      {longSleeve &&
        arms.map((a, i) => <Ellipse key={`cuff${i}`} cx={a[2][0]} cy={a[2][1] - 1} rx={sleeveW * 0.48} ry={2.5} fill={detail} />)}
    </G>
  );

  const bottomTop = y(0.395);
  const bottomPath = (() => {
    const w = loose(waist);
    const hp = loose(hips);
    if (side) {
      return `M ${CX - w + 2} ${bottomTop} L ${CX + w + 2} ${bottomTop} Q ${CX + hp} ${y(0.47)} ${CX + hp * 0.9} ${y(0.56)} L ${CX - hp - 2} ${y(0.56)} Q ${CX - hp - 4} ${y(0.47)} ${CX - w + 2} ${bottomTop} Z`;
    }
    return `M ${CX - w} ${bottomTop} L ${CX + w} ${bottomTop} Q ${CX + hp + 1} ${y(0.46)} ${CX + hp} ${y(0.55)} L ${CX - hp} ${y(0.55)} Q ${CX - hp - 1} ${y(0.46)} ${CX - w} ${bottomTop} Z`;
  })();

  const shoeLen = H * 0.07 * (g.kind === 'shoes' ? Math.max(0.9, g.ease) : 1);

  return (
    <Svg width={width} height={(width * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <ClipPath id="topClip">
          <Path d={topPath} />
        </ClipPath>
      </Defs>

      {/* Height marker */}
      <Line x1={16} y1={top} x2={16} y2={GROUND} stroke={outline} strokeWidth={1} strokeDasharray="3 4" />
      <Line x1={10} y1={top} x2={22} y2={top} stroke={outline} strokeWidth={1.5} />
      <Line x1={10} y1={GROUND} x2={22} y2={GROUND} stroke={outline} strokeWidth={1.5} />
      <SvgText x={26} y={top + 4} fontSize={11} fill={outline} fontWeight="600">
        {label}
      </SvgText>
      <Ellipse cx={CX} cy={GROUND + 2} rx={hips * 1.6} ry={5} fill={outline} opacity={0.18} />

      {/* Hood hanging behind (front view) */}
      {isHoodie && view === 'front' && (
        <Path
          d={`M ${CX - headRx * 1.15} ${y(0.175)} Q ${CX} ${y(0.13)} ${CX + headRx * 1.15} ${y(0.175)} L ${CX + neckHalf + 4} ${y(0.19)} L ${CX - neckHalf - 4} ${y(0.19)} Z`}
          fill={stroke}
        />
      )}

      {/* ---------- body ---------- */}
      <G fill={skin} stroke={outline} strokeWidth={0.8}>
        {legs.map((l, i) => (
          <G key={`leg${i}`}>
            <Line x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke={skin} strokeWidth={thighW} strokeLinecap="round" />
            <Line x1={l[1][0]} y1={l[1][1]} x2={l[2][0]} y2={l[2][1]} stroke={skin} strokeWidth={calfW} strokeLinecap="round" />
          </G>
        ))}
        {legs.map((l, i) => (
          <Ellipse
            key={`foot${i}`}
            cx={side ? l[2][0] + shoeLen * 0.35 : l[2][0] + (i === 0 ? -2 : 2)}
            cy={GROUND - 4}
            rx={side ? shoeLen * 0.62 : calfW * 0.62}
            ry={5}
          />
        ))}
        <Path d={torso} />
        <Rect x={CX - neckHalf + off(1)} y={y(0.11)} width={neckHalf * 2} height={y(0.17) - y(0.11)} stroke="none" />
        <Ellipse cx={CX + off(2)} cy={y(0.064)} rx={headRx} ry={headRy} />
        {arms.map((a, i) => (
          <G key={`arm${i}`}>
            <Polyline points={pts(a)} fill="none" stroke={skin} strokeWidth={armW} strokeLinecap="round" strokeLinejoin="round" />
            <Ellipse cx={a[2][0]} cy={a[2][1] + armW * 0.7} rx={armW * 0.45} ry={armW * 0.7} />
          </G>
        ))}
      </G>

      {/* ---------- garment ---------- */}
      {g.kind === 'bottom' && (
        <G>
          {legs.map((l, i) => (
            <G key={`pant${i}`}>
              <Line x1={l[0][0]} y1={l[0][1]} x2={l[1][0]} y2={l[1][1]} stroke={fill} strokeWidth={thighW * Math.min(1.25, e) + 4} strokeLinecap="round" />
              <Line x1={l[1][0]} y1={l[1][1]} x2={l[2][0]} y2={l[2][1] - 3} stroke={fill} strokeWidth={calfW * Math.min(1.5, e + 0.15) + 6} strokeLinecap="square" />
            </G>
          ))}
          <Path d={bottomPath} fill={fill} />
          <Line x1={CX - loose(waist) + (side ? 2 : 0)} y1={bottomTop + 4} x2={CX + loose(waist) + (side ? 2 : 0)} y2={bottomTop + 4} stroke={detail} strokeWidth={1.2} />
          {!side && <Line x1={CX} y1={bottomTop + 4} x2={CX} y2={y(0.53)} stroke={detail} strokeWidth={1} />}
          {g.category === 'Jeans' &&
            legs.map((l, i) => (
              <Polyline key={`seam${i}`} points={pts(l.map(([px, py]) => [px + (side ? 4 : i === 0 ? -thighW * 0.3 : thighW * 0.3), py]))} fill="none" stroke={detail} strokeWidth={0.8} strokeDasharray="3 3" />
            ))}
        </G>
      )}

      {g.kind === 'top' && (
        <G>
          {!side && sleeveShapes}
          <Path d={topPath} fill={fill} />
          {striped && (
            <G clipPath="url(#topClip)">
              {Array.from({ length: 14 }, (_, i) => (
                <Rect key={`stripe${i}`} x={0} y={y(0.17) + i * 9} width={VB_W} height={4} fill={g.accent ?? fill} />
              ))}
            </G>
          )}
          {graphic && view === 'front' && (
            <Rect x={CX - chest * 0.45} y={y(0.24)} width={chest * 0.9} height={chest * 0.7} rx={4} fill={g.accent ?? detail} opacity={0.9} />
          )}
          <Path d={topPath} fill="none" stroke={stroke} strokeWidth={1} />
          {/* Hem band */}
          <Line x1={CX + topLevels[3].offset - topLevels[3].half + 1} y1={topLevels[3].y - 3} x2={CX + topLevels[3].offset + topLevels[3].half - 1} y2={topLevels[3].y - 3} stroke={detail} strokeWidth={isHoodie ? 3 : 1} />
          {/* Neckline / collar */}
          {view === 'front' && isTee && (
            <Path d={`M ${CX - neckHalf - 2.5} ${y(0.163)} Q ${CX} ${y(0.19)} ${CX + neckHalf + 2.5} ${y(0.163)}`} fill={skin} stroke={detail} strokeWidth={1.4} />
          )}
          {view === 'front' && isHoodie && (
            <G>
              <Path d={`M ${CX - chest * 0.5} ${y(0.43)} L ${CX + chest * 0.5} ${y(0.43)} L ${CX + chest * 0.6} ${y(0.5)} L ${CX - chest * 0.6} ${y(0.5)} Z`} fill="none" stroke={detail} strokeWidth={1.2} />
              <Line x1={CX - 4} y1={y(0.17)} x2={CX - 5} y2={y(0.26)} stroke={detail} strokeWidth={1.4} strokeLinecap="round" />
              <Line x1={CX + 4} y1={y(0.17)} x2={CX + 5} y2={y(0.26)} stroke={detail} strokeWidth={1.4} strokeLinecap="round" />
            </G>
          )}
          {(view === 'back' || view === 'side') && isHoodie && (
            <Path
              d={side
                ? `M ${CX - chest * 0.15} ${y(0.165)} Q ${CX - chest * 1.35} ${y(0.16)} ${CX - chest * 1.05} ${y(0.26)} Q ${CX - chest * 0.7} ${y(0.21)} ${CX - chest * 0.15} ${y(0.19)} Z`
                : `M ${CX - shoulders * 0.55} ${y(0.175)} Q ${CX} ${y(0.3)} ${CX + shoulders * 0.55} ${y(0.175)} Z`}
              fill={stroke}
            />
          )}
          {side && sleeveShapes}
          {view === 'front' && isJacket && (
            <G>
              <Line x1={CX} y1={y(0.17)} x2={CX} y2={topLevels[3].y} stroke={detail} strokeWidth={1.6} />
              <Path d={`M ${CX - neckHalf - 3} ${y(0.16)} L ${CX - 2} ${y(0.21)} L ${CX - neckHalf - 7} ${y(0.2)} Z`} fill={detail} />
              <Path d={`M ${CX + neckHalf + 3} ${y(0.16)} L ${CX + 2} ${y(0.21)} L ${CX + neckHalf + 7} ${y(0.2)} Z`} fill={detail} />
              <Rect x={CX - chest * 0.8} y={y(0.42)} width={chest * 0.45} height={2} fill={detail} />
              <Rect x={CX + chest * 0.35} y={y(0.42)} width={chest * 0.45} height={2} fill={detail} />
            </G>
          )}
          {/* Puffer jackets get quilting lines */}
          {isJacket && /puffer/i.test(g.title) && (
            <G clipPath="url(#topClip)">
              {Array.from({ length: 6 }, (_, i) => (
                <Line key={`quilt${i}`} x1={0} y1={y(0.23) + i * (H * 0.045)} x2={VB_W} y2={y(0.23) + i * (H * 0.045)} stroke={detail} strokeWidth={1} />
              ))}
            </G>
          )}
        </G>
      )}

      {g.kind === 'shoes' &&
        legs.map((l, i) => (
          <G key={`shoe${i}`}>
            <Ellipse
              cx={side ? l[2][0] + shoeLen * 0.38 : l[2][0] + (i === 0 ? -2 : 2)}
              cy={GROUND - 6}
              rx={side ? shoeLen * 0.72 : calfW * 0.8}
              ry={8}
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
            />
            <Rect
              x={side ? l[2][0] - shoeLen * 0.34 : l[2][0] - calfW * 0.8 + (i === 0 ? -2 : 2)}
              y={GROUND - 3}
              width={side ? shoeLen * 1.44 : calfW * 1.6}
              height={3}
              rx={1.5}
              fill={g.accent ?? '#F4F2EE'}
            />
          </G>
        ))}

      {g.kind === 'hat' && (
        <G>
          <Path
            d={`M ${CX + off(2) - headRx * 1.08} ${y(0.06)} Q ${CX + off(2)} ${y(-0.03)} ${CX + off(2) + headRx * 1.08} ${y(0.06)} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
          <Rect x={CX + off(2) - headRx * 1.12} y={y(0.05)} width={headRx * 2.24} height={H * 0.018} rx={3} fill={detail} />
        </G>
      )}

      {g.kind === 'bag' && (
        <G>
          <Line
            x1={side ? CX - 4 : CX - shoulders * 0.55}
            y1={y(0.185)}
            x2={side ? CX + 6 : CX + hips * 0.95}
            y2={y(0.47)}
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect
            x={side ? CX - 2 : CX + hips * 0.55}
            y={y(0.45)}
            width={H * 0.09}
            height={H * 0.075}
            rx={5}
            fill={fill}
            stroke={stroke}
            strokeWidth={1}
          />
        </G>
      )}
    </Svg>
  );
}
