import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type {
  ApiEnvelope,
  BatchFillRequest,
  BatchFillResult,
  DeleteResult,
  OptionsQuery,
  Period,
  RangeQuery,
  RecordNode,
  RecordOption,
  RecordPatch,
  RecordRequest,
  StatsQuery,
  StatsResponse
} from '@ledger/shared';

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000
});

/** 判断响应体是不是后端那层 { success, message, data } 包装 */
function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return typeof body === 'object' && body !== null && 'success' in body;
}

// 统一拆解 { success, message, data }
http.interceptors.response.use(
  (res: AxiosResponse<unknown>) => {
    const body = res.data;
    if (isEnvelope(body)) {
      if (!body.success) {
        return Promise.reject(new Error(body.message || '请求失败'));
      }
      return body.data as never;
    }
    return body as never;
  },
  (err: unknown) => {
    let msg = '网络异常';
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      if (isEnvelope(body) && body.message) {
        msg = body.message;
      } else {
        msg = err.message || msg;
      }
    } else if (err instanceof Error) {
      msg = err.message || msg;
    }
    return Promise.reject(new Error(msg));
  }
);

/**
 * 把 axios 的静态类型和拦截器的实际行为对齐。
 *
 * 上面的响应拦截器已经把 { success, message, data } 拆开、直接返回了 data 本体，
 * 但 axios 的类型签名仍然认为 get/post 解析出来的是 AxiosResponse。原来的 JS 版本
 * 靠一行注释维持这个约定，新人接手很容易踩空。
 *
 * 这里用四个薄封装把它显式化：**整个前端只有下面这一处 `as unknown as`**，
 * 出了这个文件，所有接口函数的返回值类型都是真实且可信的。
 */
const unwrap = <T>(p: Promise<AxiosResponse<unknown>>): Promise<T> => p as unknown as Promise<T>;

const get = <T>(url: string, params?: object): Promise<T> => unwrap<T>(http.get(url, { params }));
const post = <T>(url: string, body?: unknown): Promise<T> => unwrap<T>(http.post(url, body));
const put = <T>(url: string, body?: unknown): Promise<T> => unwrap<T>(http.put(url, body));
const del = <T>(url: string): Promise<T> => unwrap<T>(http.delete(url));

/* ------------------------------------------------------------ 记账 */

/** 树形查询：顶级为支出名称，下挂子项 */
export const fetchTree = (params: RangeQuery = {}): Promise<RecordNode[]> =>
  get<RecordNode[]>('/records/tree', params);

/** 扁平明细，仅叶子节点 */
export const fetchLeaves = (params: RangeQuery = {}): Promise<RecordNode[]> =>
  get<RecordNode[]>('/records/leaves', params);

/** 父项下拉选项 */
export const fetchOptions = (params: OptionsQuery = {}): Promise<RecordOption[]> =>
  get<RecordOption[]>('/records/options', params);

/** 已有月份列表（倒序） */
export const fetchPeriods = (): Promise<Period[]> => get<Period[]>('/records/periods');

export const createRecord = (data: RecordRequest): Promise<RecordNode> =>
  post<RecordNode>('/records', data);

export const updateRecord = (id: number, data: RecordPatch): Promise<RecordNode> =>
  put<RecordNode>(`/records/${id}`, data);

export const deleteRecord = (id: number): Promise<DeleteResult> =>
  del<DeleteResult>(`/records/${id}`);

/** 按月批量生成：若干子项 × 一段月份 */
export const batchFill = (data: BatchFillRequest): Promise<BatchFillResult> =>
  post<BatchFillResult>('/records/batch', data);

/* ------------------------------------------------------------ 统计 */

export const fetchStats = (params: StatsQuery): Promise<StatsResponse> =>
  get<StatsResponse>('/stats', params);

export default http;
