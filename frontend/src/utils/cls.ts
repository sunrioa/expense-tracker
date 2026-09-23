/** 拼 className：cls('row', open && 'is-open') */
export const cls = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

const objectIds = new WeakMap<object, number>();
let objectSerial = 0;

/**
 * 给对象一个稳定的数字 key。
 *
 * 面板每次打开都传入一个新的状态对象，拿它当 React key，表单就会从头初始化；
 * 关闭动画期间仍是同一个对象，key 不变，内容不会闪。
 */
export function objectKey(o: object): number {
  let k = objectIds.get(o);
  if (k === undefined) {
    k = ++objectSerial;
    objectIds.set(o, k);
  }
  return k;
}
