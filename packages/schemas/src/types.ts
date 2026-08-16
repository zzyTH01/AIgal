/** 全项目共享 ID 类型 */
export type ID = string;
export type RunId = ID;
export type TurnId = ID;
export type EventId = ID;
export type CharacterId = ID;
export type RelationshipId = ID;
export type MemoryId = ID;
export type SaveId = ID;
export type OptionId = ID;

/** 游戏内时间戳：{ day, time: "HH:mm" } */
export interface GameTimestamp {
  day: number;
  time: string; // "HH:mm"
}

/** 通用百分比 0~100 标量 */
export type Percent = number;
