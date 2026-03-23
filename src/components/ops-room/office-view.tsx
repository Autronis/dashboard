"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getProjectColor } from "./project-colors";
import type { Agent, AgentStatus } from "./types";

// ============ LAYOUT ============

const OFFICE_W = 960;
const OFFICE_H = 720;

// Sem's desk (CEO) — top-left corner, own space
const SEM_DESK = { x: 40, y: 25 };

// Fixed desk positions by agent ID
const DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  // Het Bestuur — centered above builders
  theo:    { x: 200, y: 25 },
  toby:    { x: 400, y: 25 },
  jones:   { x: 600, y: 25 },
  brent:   { x: 800, y: 25 },

  // Builder row 1
  wout:    { x: 300, y: 165 },
  bas:     { x: 500, y: 165 },
  gabriel: { x: 700, y: 165 },

  // Builder row 2
  tijmen:  { x: 300, y: 305 },
  pedro:   { x: 500, y: 305 },
  vincent: { x: 700, y: 305 },

  // Builder row 3
  noah:    { x: 300, y: 445 },
  nikkie:  { x: 500, y: 445 },
  adam:    { x: 700, y: 445 },

  // Support row
  ari:     { x: 300, y: 585 },
  rodi:    { x: 500, y: 585 },
};

const MEETING_ROOM = { x: 30, y: 165, w: 220, h: 180 };
const COFFEE_CORNER = { x: 30, y: 420, w: 220, h: 270 };

const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "#4ade80",
  reviewing: "#c084fc",
  idle: "#9ca3af",
  error: "#f87171",
  offline: "#4b5563",
};

// ============ SUB-COMPONENTS ============

function OfficeFloor() {
  return (
    <g>
      <rect x={0} y={0} width={OFFICE_W} height={OFFICE_H} rx={12}
        fill="var(--card)" stroke="var(--border)" strokeWidth={1.5} />
      {Array.from({ length: 24 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 42} y1={0} x2={i * 42} y2={OFFICE_H}
          stroke="var(--border)" strokeWidth={0.25} opacity={0.35} />
      ))}
      {Array.from({ length: 18 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 42} x2={OFFICE_W} y2={i * 42}
          stroke="var(--border)" strokeWidth={0.25} opacity={0.35} />
      ))}
    </g>
  );
}

function SemDesk() {
  const { x, y } = SEM_DESK;
  return (
    <g>
      {/* Room outline */}
      <rect x={x - 10} y={y - 10} width={180} height={110} rx={10}
        fill="var(--bg)" stroke="var(--accent)" strokeWidth={1} opacity={0.3} />
      {/* Desk */}
      <rect x={x} y={y + 30} width={160} height={50} rx={6}
        fill="var(--card)" stroke="var(--accent)" strokeWidth={1} opacity={0.8} />
      {/* Double monitor */}
      <rect x={x + 30} y={y} width={45} height={30} rx={3}
        fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.5} />
      <rect x={x + 85} y={y} width={45} height={30} rx={3}
        fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.5} />
      {/* Monitor glow */}
      <rect x={x + 32} y={y + 3} width={41} height={24} rx={2}
        fill="var(--accent)" opacity={0.06} />
      <rect x={x + 87} y={y + 3} width={41} height={24} rx={2}
        fill="var(--accent)" opacity={0.06} />
      {/* Name plate */}
      <rect x={x + 30} y={y + 68} width={100} height={18} rx={4}
        fill="var(--accent)" opacity={0.12} />
      <text x={x + 80} y={y + 80} textAnchor="middle"
        fill="var(--accent)" fontSize={10} fontWeight={700}>
        Sem
      </text>
      <text x={x + 80} y={y + 96} textAnchor="middle"
        fill="var(--accent)" fontSize={7} opacity={0.5}>
        CEO
      </text>
    </g>
  );
}

function MeetingRoom({ projectName, count }: { projectName: string | null; count: number }) {
  const { x, y, w } = MEETING_ROOM;
  const h = count > 2 ? 220 : MEETING_ROOM.h;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12}
        fill="var(--bg)" stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
      <rect x={x + 50} y={y + 50} width={120} height={Math.min(70, h - 80)} rx={8}
        fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
      <text x={x + w / 2} y={y + 18} textAnchor="middle"
        fill="var(--accent)" fontSize={9} fontWeight={600} opacity={0.6}>
        MEETING ROOM
      </text>
      {projectName && (
        <text x={x + w / 2} y={y + 34} textAnchor="middle"
          fill={getProjectColor(projectName)} fontSize={8} opacity={0.7}>
          {projectName}
        </text>
      )}
    </g>
  );
}

function CoffeeCornerArea({ count }: { count: number }) {
  const { x, y, w, h } = COFFEE_CORNER;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12}
        fill="var(--bg)" stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3" opacity={0.3} />
      {/* Coffee icon + label */}
      <text x={x + 14} y={y + 20} fontSize={12}>&#9749;</text>
      <text x={x + 32} y={y + 19} fill="var(--text-tertiary)" fontSize={9} fontWeight={500}>
        Koffiehoek
      </text>
      <text x={x + w - 10} y={y + 19} textAnchor="end"
        fill="var(--text-tertiary)" fontSize={8} opacity={0.4}>
        {count} beschikbaar
      </text>
      {/* Bench seats (two long benches) */}
      <rect x={x + 15} y={y + 35} width={w - 30} height={8} rx={3}
        fill="var(--border)" opacity={0.3} />
      <rect x={x + 15} y={y + 95} width={w - 30} height={8} rx={3}
        fill="var(--border)" opacity={0.3} />
      <rect x={x + 15} y={y + 155} width={w - 30} height={8} rx={3}
        fill="var(--border)" opacity={0.3} />
    </g>
  );
}

function Desk({ x, y, name, color, projectColor, isManager, isActive }: {
  x: number; y: number; name: string; color: string;
  projectColor?: string; isManager?: boolean; isActive?: boolean;
}) {
  const dw = isManager ? 140 : 120;
  const mw = isManager ? 60 : 50;
  const mh = isManager ? 36 : 32;
  const borderColor = projectColor ?? color;
  return (
    <g>
      {/* Desk surface */}
      <rect x={x} y={y + mh - 10} width={dw} height={50} rx={6}
        fill="var(--card)" stroke="var(--border)" strokeWidth={1} />
      {/* Monitor */}
      <rect x={x + (dw - mw) / 2} y={y} width={mw} height={mh} rx={4}
        fill="var(--bg)" stroke={borderColor} strokeWidth={isManager ? 2 : 1.5} />
      {/* Screen glow when active */}
      {isActive && (
        <motion.rect
          x={x + (dw - mw) / 2 + 2} y={y + 2} width={mw - 4} height={mh - 4} rx={3}
          fill={borderColor} opacity={0.08}
          animate={{ opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      {/* Monitor stand */}
      <rect x={x + dw / 2 - 5} y={y + mh} width={10} height={6} fill="var(--border)" />
      {/* Keyboard */}
      <rect x={x + (dw - 40) / 2} y={y + mh + 16} width={40} height={8} rx={2}
        fill="var(--border)" opacity={isActive ? 0.7 : 0.4} />
      {/* Name plate with project color border */}
      <rect x={x + (dw - 84) / 2} y={y + mh + 30} width={84} height={18} rx={3}
        fill={borderColor} opacity={0.12} stroke={borderColor} strokeWidth={0.5} />
      <text x={x + dw / 2} y={y + mh + 43} textAnchor="middle"
        fill={color} fontSize={9} fontWeight={600}>
        {name}
      </text>
    </g>
  );
}

function Avatar({ x, y, color, status, isTyping, name }: {
  x: number; y: number; color: string; status: AgentStatus; isTyping: boolean; name?: string;
}) {
  if (status === "offline") return null;

  const isIdle = status === "idle";

  return (
    <motion.g
      initial={{ opacity: 0, y: y + 8 }}
      animate={{ opacity: 1, y }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.g
        animate={isIdle ? { rotate: [-3, 3, -3] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: `${x + 12}px ${y + 28}px` }}
      >
        {/* Head */}
        <circle cx={x + 12} cy={y + 8} r={7.5} fill={color} opacity={0.9} />
        {/* Eyes */}
        {isIdle ? (
          <>
            {/* Relaxed/sleepy eyes */}
            <line x1={x + 8} y1={y + 7} x2={x + 11} y2={y + 7} stroke="var(--bg)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={x + 13} y1={y + 7} x2={x + 16} y2={y + 7} stroke="var(--bg)" strokeWidth={1.5} strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx={x + 9} cy={y + 7} r={1.5} fill="var(--bg)" />
            <circle cx={x + 15} cy={y + 7} r={1.5} fill="var(--bg)" />
          </>
        )}
        {/* Body */}
        <rect x={x + 2} y={y + 17} width={20} height={14} rx={4} fill={color} opacity={0.7} />
      </motion.g>

      {/* Typing hands */}
      {isTyping && (
        <motion.g
          animate={{ y: [0, -1.5, 0, -1, 0] }}
          transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x={x + 1} y={y + 28} width={8} height={3.5} rx={1.5} fill={color} opacity={0.5} />
          <rect x={x + 15} y={y + 28} width={8} height={3.5} rx={1.5} fill={color} opacity={0.5} />
        </motion.g>
      )}

      {/* Status dot */}
      <circle cx={x + 21} cy={y + 2} r={3} fill={STATUS_COLORS[status]} />
      {status === "working" && (
        <motion.circle cx={x + 21} cy={y + 2} r={3}
          fill={STATUS_COLORS[status]}
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Name label */}
      {name && (
        <text x={x + 12} y={y + 44} textAnchor="middle"
          fill="var(--text-tertiary)" fontSize={7}>
          {name}
        </text>
      )}
    </motion.g>
  );
}

function SpeechBubble({ x, y, text }: { x: number; y: number; text: string }) {
  const maxLen = 30;
  const displayText = text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  const bubbleWidth = Math.max(80, displayText.length * 5.2 + 20);
  return (
    <motion.g
      initial={{ opacity: 0, y: y + 4, scale: 0.9 }}
      animate={{ opacity: 1, y, scale: 1 }}
      exit={{ opacity: 0, y: y + 4, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      <rect x={x - bubbleWidth / 2} y={y - 18} width={bubbleWidth} height={20} rx={5}
        fill="var(--card)" stroke="var(--border)" strokeWidth={0.7} />
      <polygon
        points={`${x - 3},${y + 2} ${x + 3},${y + 2} ${x},${y + 6}`}
        fill="var(--card)" stroke="var(--border)" strokeWidth={0.7} strokeLinejoin="round"
      />
      <line x1={x - 2} y1={y + 2} x2={x + 2} y2={y + 2} stroke="var(--card)" strokeWidth={1.2} />
      <text x={x} y={y - 5} textAnchor="middle"
        fill="var(--text-secondary)" fontSize={7.5} fontFamily="monospace">
        {displayText}
      </text>
    </motion.g>
  );
}

function Tooltip({ x, y, agent }: { x: number; y: number; agent: Agent }) {
  const project = agent.huidigeTaak?.project ?? "Geen project";
  const projectColor = getProjectColor(project);
  const w = 160;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <rect x={x - w / 2} y={y} width={w} height={52} rx={6}
        fill="var(--bg)" stroke="var(--border)" strokeWidth={1}
        filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))" />
      <text x={x} y={y + 14} textAnchor="middle"
        fill="var(--text-primary)" fontSize={9} fontWeight={600}>
        {agent.naam}
      </text>
      <text x={x} y={y + 26} textAnchor="middle"
        fill={projectColor} fontSize={7.5}>
        {project}
      </text>
      <text x={x} y={y + 38} textAnchor="middle"
        fill="var(--text-tertiary)" fontSize={7}>
        {agent.voltooideVandaag} taken · {agent.terminal.length > 0 ? agent.terminal[agent.terminal.length - 1].tekst.slice(0, 25) : "idle"}
      </text>
      <text x={x} y={y + 48} textAnchor="middle"
        fill="var(--text-tertiary)" fontSize={6.5}>
        {"\u20AC"}{agent.kosten.kostenVandaag.toFixed(2)} vandaag
      </text>
    </motion.g>
  );
}

// ============ MAIN COMPONENT ============

interface OfficeViewProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
}

export function OfficeView({ agents, selectedId, onSelect }: OfficeViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const coffeeAgents = useMemo(() =>
    agents.filter((a) => (a.status === "idle" || a.status === "offline") && !DESK_POSITIONS[a.id]),
  [agents]);

  // Meeting room detection
  const { meetingAgentIds, meetingProject } = useMemo(() => {
    const groups: Record<string, Agent[]> = {};
    agents.forEach((a) => {
      if (a.huidigeTaak && (a.status === "working" || a.status === "reviewing")) {
        const proj = a.huidigeTaak.project;
        if (!groups[proj]) groups[proj] = [];
        groups[proj].push(a);
      }
    });
    const ids = new Set<string>();
    let proj: string | null = null;
    Object.entries(groups).forEach(([p, g]) => {
      if (g.length >= 2) {
        g.forEach((a) => ids.add(a.id));
        proj = p;
      }
    });
    return { meetingAgentIds: ids, meetingProject: proj };
  }, [agents]);

  const meetingSeats = useMemo(() => {
    const seats = [
      { x: MEETING_ROOM.x + 20, y: MEETING_ROOM.y + 55 },
      { x: MEETING_ROOM.x + 140, y: MEETING_ROOM.y + 55 },
      { x: MEETING_ROOM.x + 20, y: MEETING_ROOM.y + 110 },
      { x: MEETING_ROOM.x + 140, y: MEETING_ROOM.y + 110 },
    ];
    const map = new Map<string, { x: number; y: number }>();
    let i = 0;
    meetingAgentIds.forEach((id) => { map.set(id, seats[i % seats.length]); i++; });
    return map;
  }, [meetingAgentIds]);

  // Coffee corner positions — sit on benches
  const coffeeSeatPositions = useMemo(() => {
    const seats: { x: number; y: number }[] = [];
    const benchY = [COFFEE_CORNER.y + 48, COFFEE_CORNER.y + 108, COFFEE_CORNER.y + 168, COFFEE_CORNER.y + 218];
    const cols = [COFFEE_CORNER.x + 20, COFFEE_CORNER.x + 65, COFFEE_CORNER.x + 110, COFFEE_CORNER.x + 155];
    for (const by of benchY) {
      for (const cx of cols) {
        seats.push({ x: cx, y: by });
      }
    }
    return seats;
  }, []);

  return (
    <div
      className="w-full overflow-x-auto rounded-2xl border border-autronis-border bg-autronis-card/50 p-2"
      style={{ perspective: "1200px" }}
    >
      <svg
        viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`}
        className="w-full min-w-[700px]"
        style={{
          maxHeight: "720px",
          transform: "rotateX(2deg)",
          transformOrigin: "center top",
        }}
      >
        <OfficeFloor />

        {/* Sem's desk */}
        <SemDesk />

        {/* Rooms */}
        <MeetingRoom projectName={meetingProject} count={meetingAgentIds.size} />
        <CoffeeCornerArea count={coffeeAgents.length} />

        {/* Fixed desks */}
        {Object.entries(DESK_POSITIONS).map(([agentId, pos]) => {
          const agent = agents.find((a) => a.id === agentId);
          if (!agent) return null;
          const isManager = agent.rol === "manager";
          const isActive = agent.status === "working" || agent.status === "reviewing";
          const projectColor = agent.huidigeTaak ? getProjectColor(agent.huidigeTaak.project) : undefined;
          const inMeeting = meetingAgentIds.has(agentId);

          return (
            <g key={`desk-${agentId}`}
              onClick={() => onSelect(agent)}
              onMouseEnter={() => setHoveredId(agentId)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              <Desk
                x={pos.x} y={pos.y}
                name={agent.naam}
                color={agent.avatar}
                projectColor={projectColor}
                isManager={isManager}
                isActive={isActive}
              />

              {/* Project label */}
              {agent.huidigeTaak && (
                <text x={pos.x + (isManager ? 70 : 60)} y={pos.y + (isManager ? 86 : 78)} textAnchor="middle"
                  fill={projectColor} fontSize={7} opacity={0.6}>
                  {agent.huidigeTaak.project}
                </text>
              )}

              {/* Selection highlight */}
              {selectedId === agentId && (
                <motion.rect
                  x={pos.x - 5} y={pos.y - 5}
                  width={(isManager ? 140 : 120) + 10} height={90} rx={8}
                  fill="none" stroke="var(--accent)" strokeWidth={1.5}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Avatar at desk */}
              {isActive && !inMeeting && (
                <Avatar
                  x={pos.x - 20}
                  y={pos.y + 8}
                  color={agent.avatar}
                  status={agent.status}
                  isTyping={agent.status === "working"}
                />
              )}

              {/* Offline: rotated empty chair */}
              {agent.status === "offline" && (
                <g opacity={0.2}>
                  <rect x={pos.x - 14} y={pos.y + 22} width={14} height={18} rx={3}
                    fill="var(--border)" transform={`rotate(15 ${pos.x - 7} ${pos.y + 31})`} />
                </g>
              )}

              {/* Idle at desk: chair visible but no avatar (they're in coffee corner if idle AND not having a desk task) */}
              {agent.status === "idle" && DESK_POSITIONS[agent.id] && (
                <g opacity={0.2}>
                  <rect x={pos.x - 14} y={pos.y + 22} width={14} height={18} rx={3}
                    fill="var(--border)" />
                </g>
              )}
            </g>
          );
        })}

        {/* Meeting room avatars */}
        {Array.from(meetingAgentIds).map((agentId) => {
          const agent = agents.find((a) => a.id === agentId);
          if (!agent) return null;
          const pos = meetingSeats.get(agentId);
          if (!pos) return null;
          return (
            <g key={`meet-${agentId}`}
              onClick={() => onSelect(agent)}
              style={{ cursor: "pointer" }}
            >
              <Avatar x={pos.x} y={pos.y} color={agent.avatar}
                status={agent.status} isTyping={false} name={agent.naam} />
            </g>
          );
        })}

        {/* Coffee corner avatars on benches */}
        {coffeeAgents.map((agent, i) => {
          const seat = coffeeSeatPositions[i];
          if (!seat) return null;
          return (
            <g key={`coffee-${agent.id}`}
              onClick={() => onSelect(agent)}
              onMouseEnter={() => setHoveredId(agent.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              <Avatar x={seat.x} y={seat.y} color={agent.avatar}
                status="idle" isTyping={false} name={agent.naam} />
              {selectedId === agent.id && (
                <motion.rect
                  x={seat.x - 3} y={seat.y - 3}
                  width={30} height={50} rx={5}
                  fill="none" stroke="var(--accent)" strokeWidth={1}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </g>
          );
        })}

        {/* Speech bubble — only for selected agent */}
        <AnimatePresence>
          {selectedId && (() => {
            const agent = agents.find((a) => a.id === selectedId);
            if (!agent || !agent.huidigeTaak) return null;
            const pos = DESK_POSITIONS[agent.id];
            if (!pos) return null;
            const isManager = agent.rol === "manager";
            const bubbleText = agent.terminal.length > 0
              ? agent.terminal[agent.terminal.length - 1].tekst
              : agent.huidigeTaak.beschrijving;
            return (
              <SpeechBubble
                key={`bubble-${agent.id}`}
                x={pos.x + (isManager ? 70 : 60)}
                y={pos.y - 16}
                text={bubbleText}
              />
            );
          })()}
        </AnimatePresence>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredId && hoveredId !== selectedId && (() => {
            const agent = agents.find((a) => a.id === hoveredId);
            if (!agent) return null;
            const pos = DESK_POSITIONS[agent.id];
            if (pos) {
              return <Tooltip key="tip" x={pos.x + 60} y={pos.y + 90} agent={agent} />;
            }
            // Coffee corner agent
            const coffeeIdx = coffeeAgents.findIndex((a) => a.id === hoveredId);
            const seat = coffeeSeatPositions[coffeeIdx];
            if (seat) {
              return <Tooltip key="tip" x={seat.x + 12} y={seat.y + 50} agent={agent} />;
            }
            return null;
          })()}
        </AnimatePresence>

        {/* Office label */}
        <text x={OFFICE_W - 14} y={OFFICE_H - 10} textAnchor="end"
          fill="var(--text-tertiary)" fontSize={9} opacity={0.3} fontWeight={500}>
          Autronis HQ
        </text>
      </svg>
    </div>
  );
}
