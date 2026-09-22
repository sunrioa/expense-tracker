import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// 统一拆解 { success, message, data }
http.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'success')) {
      if (!body.success) {
        return Promise.reject(new Error(body.message || '请求失败'));
      }
      return body.data;
    }
    return body;
  },
  (err) => {
    const body = err.response && err.response.data;
    const msg = (body && body.message) || err.message || '网络异常';
    return Promise.reject(new Error(msg));
  }
);

export const fetchTree = (params) => http.get('/records/tree', { params });
export const fetchLeaves = (params) => http.get('/records/leaves', { params });
export const fetchOptions = (params) => http.get('/records/options', { params });
export const fetchPeriods = () => http.get('/records/periods');
export const createRecord = (data) => http.post('/records', data);
export const updateRecord = (id, data) => http.put(`/records/${id}`, data);
export const deleteRecord = (id) => http.delete(`/records/${id}`);
export const batchFill = (data) => http.post('/records/batch', data);
export const fetchStats = (params) => http.get('/stats', { params });

export default http;
