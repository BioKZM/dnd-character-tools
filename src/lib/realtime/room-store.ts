type RoomActionType = "joined" | "roll" | "spell" | "feat" | "system";

export type RoomEvent = {
  id: string;
  type: RoomActionType;
  actorName: string;
  message: string;
  createdAt: string;
};

export type PartyMember = {
  id: string;
  name: string;
  joinedAt: string;
};

export type RoomSnapshot = {
  id: string;
  name: string;
  hostId: string;
  members: PartyMember[];
  events: RoomEvent[];
  selectedSpellId?: string;
  selectedFeatId?: string;
  updatedAt: string;
};

type Room = RoomSnapshot;
type Subscriber = (snapshot: RoomSnapshot) => void;

type RoomStore = {
  rooms: Map<string, Room>;
  subscribers: Map<string, Set<Subscriber>>;
};

declare global {
  var __codexRoomStore__: RoomStore | undefined;
}

const roomStore: RoomStore =
  globalThis.__codexRoomStore__ ??
  (globalThis.__codexRoomStore__ = {
    rooms: new Map<string, Room>(),
    subscribers: new Map<string, Set<Subscriber>>(),
  });

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emit(roomId: string) {
  const room = roomStore.rooms.get(roomId);
  if (!room) {
    return;
  }

  const subscribers = roomStore.subscribers.get(roomId);
  if (!subscribers) {
    return;
  }

  const snapshot = structuredClone(room) satisfies RoomSnapshot;
  for (const subscriber of subscribers) {
    subscriber(snapshot);
  }
}

function appendEvent(room: Room, type: RoomActionType, actorName: string, message: string) {
  room.events.unshift({
    id: createId("event"),
    type,
    actorName,
    message,
    createdAt: new Date().toISOString(),
  });

  room.events = room.events.slice(0, 40);
  room.updatedAt = new Date().toISOString();
}

export function createRoom(name: string, hostName: string) {
  const roomId = createId("room");
  const hostId = createId("member");

  const room: Room = {
    id: roomId,
    name,
    hostId,
    members: [
      {
        id: hostId,
        name: hostName,
        joinedAt: new Date().toISOString(),
      },
    ],
    events: [],
    updatedAt: new Date().toISOString(),
  };

  appendEvent(room, "system", "System", `${hostName} created the room.`);
  roomStore.rooms.set(roomId, room);
  emit(roomId);

  return {
    room: structuredClone(room) satisfies RoomSnapshot,
    memberId: hostId,
  };
}

export function getRoomSnapshot(roomId: string) {
  const room = roomStore.rooms.get(roomId);
  return room ? (structuredClone(room) satisfies RoomSnapshot) : null;
}

export function joinRoom(roomId: string, name: string) {
  const room = roomStore.rooms.get(roomId);
  if (!room) {
    return null;
  }

  const member = {
    id: createId("member"),
    name,
    joinedAt: new Date().toISOString(),
  };

  room.members.push(member);
  appendEvent(room, "joined", name, `${name} entered the party room.`);
  emit(roomId);

  return {
    room: structuredClone(room) satisfies RoomSnapshot,
    memberId: member.id,
  };
}

export function addRoll(roomId: string, actorName: string, formula: string, total: number) {
  const room = roomStore.rooms.get(roomId);
  if (!room) {
    return null;
  }

  appendEvent(room, "roll", actorName, `rolled ${formula} and got ${total}.`);
  emit(roomId);
  return structuredClone(room) satisfies RoomSnapshot;
}

export function focusSpell(roomId: string, actorName: string, spellId: string, spellName: string) {
  const room = roomStore.rooms.get(roomId);
  if (!room) {
    return null;
  }

  room.selectedSpellId = spellId;
  appendEvent(room, "spell", actorName, `shared the spell ${spellName}.`);
  emit(roomId);
  return structuredClone(room) satisfies RoomSnapshot;
}

export function focusFeat(roomId: string, actorName: string, featId: string, featName: string) {
  const room = roomStore.rooms.get(roomId);
  if (!room) {
    return null;
  }

  room.selectedFeatId = featId;
  appendEvent(room, "feat", actorName, `highlighted the feat ${featName}.`);
  emit(roomId);
  return structuredClone(room) satisfies RoomSnapshot;
}

export function subscribeToRoom(roomId: string, subscriber: Subscriber) {
  const subscribers = roomStore.subscribers.get(roomId) ?? new Set<Subscriber>();
  subscribers.add(subscriber);
  roomStore.subscribers.set(roomId, subscribers);

  const snapshot = getRoomSnapshot(roomId);
  if (snapshot) {
    subscriber(snapshot);
  }

  return () => {
    const currentSubscribers = roomStore.subscribers.get(roomId);
    currentSubscribers?.delete(subscriber);
    if (currentSubscribers?.size === 0) {
      roomStore.subscribers.delete(roomId);
    }
  };
}
