import http from "./http";

export const getStudents = async () => {
  const response = await http.get("/students");
  return response.data;
};

export const getMyStudentProfile = async () => {
  const response = await http.get("/students/me");
  return response.data;
};

export const createStudent = async (studentData) => {
  const response = await http.post("/students", studentData);
  return response.data;
};

export const updateStudent = async (id, studentData) => {
  const response = await http.put(`/students/${id}`, studentData);
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await http.delete(`/students/${id}`);
  return response.data;
};
