import { JSONArray, JSONObject, JSONPrimitive } from './json-types';

export type Permission = 'r' | 'w' | 'rw' | 'none';
const readPossibilities = ['r', 'rw'];
const writePossibilities = ['w', 'rw'];

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue = JSONObject | JSONArray | StoreResult | (() => StoreResult);

export interface IStore {
	defaultPolicy: Permission;
	allowedToRead(key: string): boolean;
	allowedToWrite(key: string): boolean;
	read(path: string): StoreResult;
	write(path: string, value: StoreValue): StoreValue;
	writeEntries(entries: JSONObject): void;
	entries(): JSONObject;
}

export function Restrict(policy: Permission = 'none'): any {
	return function (target: any, key: string): void {
		if (!target.restrictions) target.restrictions = new Map();
		target.restrictions.set(key, policy);
	};
}

export class Store implements IStore {
	defaultPolicy: Permission = 'rw';
	restrictions?: Map<string, Permission>;

	allowedToRead(key: string): boolean {
		const keys = key.split(':');
		if (keys.length >= 2 && (typeof (this as any)[keys[0]] === 'function' || keys[0] === 'user')) return true;

		const foundPolicy = this.restrictions?.get(key);
		if (foundPolicy && !readPossibilities.includes(foundPolicy)) return false;

		return readPossibilities.includes(this.defaultPolicy);
	}

	allowedToWrite(key: string): boolean {
		const keys = key.split(':');
		if (keys.length >= 2 && (typeof (this as any)[keys[0]] === 'function' || keys[0] === 'user')) return true;

		const foundPolicy = this.restrictions?.get(key);
		if (foundPolicy && !writePossibilities.includes(foundPolicy)) return false;

		return writePossibilities.includes(this.defaultPolicy);
	}

	read(path: string): StoreResult {
		const keys = path.split(':');

		if (!this.allowedToRead(path)) throw new Error(`Reading ${path} is not allowed.`);

		let current = this as any;
		for (const key of keys) {
			if (current[key] === undefined) throw new Error(`Reading ${path} is not existing.`);

			current = typeof current[key] === 'function' ? current[key]() : current[key];
		}

		return current;
	}

	write(path: string, value: StoreValue): StoreValue {
		const keys = path.split(':');

		if (!this.allowedToWrite(path)) throw new Error(`Write ${path} is not allowed.`);

		let current = this as any;
		const last = keys.pop() as string;
		for (const key of keys) {
			if (current[key] === undefined) current[key] = {};

			current = current[key];
		}
		current[last] = value;

		return current[last];
	}

	writeEntries(entries: JSONObject): void {
		for (const key in entries) this.write(key, entries[key]);
	}

	entries(): JSONObject {
		const entries = {} as JSONObject;
		this.restrictions?.forEach((permission: Permission, key: string) => {
			if (!['r', 'rw'].includes(permission)) return;

			entries[key] = (this as any)[key];
		});

		return entries;
	}
}
