/**
 * 从 catch 到的东西里取一条能给用户看的消息。
 *
 * strict 模式下 catch 变量是 unknown —— 这其实暴露了原来 JS 版本的一个假设：
 * 它直接写 `e.message`，默认抛出来的一定是 Error。api 层现在保证 reject 的
 * 都是 Error，但第三方库、运行时异常未必，这里兜一下底。
 */
export function errMsg(e: unknown, fallback = '操作失败'): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  return fallback;
}
