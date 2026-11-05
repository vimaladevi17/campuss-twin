import { useEffect, useState } from "react";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../api/studentApi";
function Students() {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    registerNumber: "",
    email: "",
    department: "",
    year: "",
    section: "",
    attendance: "",
  });

  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    }
  };

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
  event.preventDefault();

  try {
    const data = {
      ...formData,
      year: Number(formData.year),
      attendance: Number(formData.attendance),
    };

    if (editingId) {
      // UPDATE existing student
      const updatedStudent = await updateStudent(editingId, data);

      setStudents(
        students.map((student) =>
          student._id === editingId
            ? updatedStudent
            : student
        )
      );

      setMessage("Student updated successfully! ✅");
      setEditingId(null);
    } else {
      // CREATE new student
      const newStudent = await createStudent(data);

      setStudents([...students, newStudent]);

      setMessage("Student added successfully! ✅");
    }

    setFormData({
      name: "",
      registerNumber: "",
      email: "",
      department: "",
      year: "",
      section: "",
      attendance: "",
    });

  } catch (error) {
    console.error("Student operation failed:", error);

    setMessage(
      error.response?.data?.message ||
      "Student operation failed ❌"
    );
  }
};
 const handleEdit = (student) => {
  setEditingId(student._id);

  setFormData({
    name: student.name,
    registerNumber: student.registerNumber,
    email: student.email,
    department: student.department,
    year: student.year,
    section: student.section,
    attendance: student.attendance,
  });

  setMessage("");
};
const handleDelete = async (id) => {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this student?"
  );

  if (!confirmDelete) {
    return;
  }

  try {
    await deleteStudent(id);

    setStudents(
      students.filter((student) => student._id !== id)
    );

    setMessage("Student deleted successfully! ✅");

  } catch (error) {
    console.error(error);

    setMessage(
      error.response?.data?.message ||
      "Failed to delete student ❌"
    );
  }
};
const filteredStudents = students.filter((student) => {
  const search = searchTerm.toLowerCase();

  return (
    student.name.toLowerCase().includes(search) ||
    student.registerNumber.toLowerCase().includes(search) ||
    student.email.toLowerCase().includes(search) ||
    student.department.toLowerCase().includes(search)
  );
});
  return (
    <div style={{ padding: "110px 30px 40px" }}>
      <h1>Student Management</h1>

      <h2>Add New Student</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Student Name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="text"
          name="registerNumber"
          placeholder="Register Number"
          value={formData.registerNumber}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="text"
          name="department"
          placeholder="Department"
          value={formData.department}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="number"
          name="year"
          placeholder="Year"
          value={formData.year}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="text"
          name="section"
          placeholder="Section"
          value={formData.section}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <input
          type="number"
          name="attendance"
          placeholder="Attendance %"
          value={formData.attendance}
          onChange={handleChange}
          required
        />

        <br />
        <br />

        <button type="submit">
          {editingId ? "Update Student" : "Add Student"}
        </button>
      </form>

      <p>{message}</p>

      <hr />

      <h2>Students List</h2>
           <input
  type="text"
  placeholder="Search students..."
  value={searchTerm}
  onChange={(event) => setSearchTerm(event.target.value)}
  style={{
    padding: "10px",
    width: "300px",
    marginBottom: "20px",
  }}
/>  
      {students.length === 0 ? (
        <p>No students found.</p>
      ) : (
        filteredStudents.map((student) => (
          <div
            key={student._id}
            style={{
              border: "1px solid #ccc",
              padding: "15px",
              marginBottom: "10px",
            }}
          >
            <h3>{student.name}</h3>
            <p>Register Number: {student.registerNumber}</p>
            <p>Email: {student.email}</p>
            <p>Department: {student.department}</p>
            <p>Year: {student.year}</p>
            <p>Section: {student.section}</p>
            <p>Attendance: {student.attendance}%</p>
            <button onClick={() => handleEdit(student)}>
              <button
  onClick={() => handleDelete(student._id)}
  style={{ marginLeft: "10px" }}
>
  Delete
</button>
  Edit
</button>
          </div>
        ))
      )}
    </div>
  );
}

export default Students;