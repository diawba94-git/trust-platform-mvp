import api from './api';

export const createActor = async (data) => {
  const response = await api.post('/admin/actors/create', data);
  return response.data;
};
