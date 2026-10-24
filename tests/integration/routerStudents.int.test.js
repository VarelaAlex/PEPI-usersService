const request = require("supertest");
const express = require("express");
const routerStudents = require("../../routers/routerStudents");
const { generateTokens } = require("../../auth");

const database = require("../../database");

const app = express();
app.use(express.json());
app.use("/students", routerStudents);

describe("Students Router", () => {
	let teacherToken;
	let studentToken;
	let studentId;

	beforeAll(() => {
		const teacher = { id: 1, role: "teacher" };
		teacherToken = generateTokens(teacher).accessToken;
		const student = { id: 1, role: "student" };
		studentToken = generateTokens(student).accessToken;
	});

	afterAll(() => {
		database.end();
	});

	describe("POST /students/login", () => {
		it("should login a student with valid username", async () => {
			const response = await request(app)
				.post("/students/login")
				.send({ username: "maria1" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("refreshToken");
			expect(response.body).toHaveProperty("name", "María");
		});

		it("should return 404 if username does not exist", async () => {
			const response = await request(app)
				.post("/students/login")
				.send({ username: "nonexistent" });

			expect(response.status).toBe(404);
		});
	});

	describe("POST /students", () => {
		it("should create a student with valid data", async () => {

			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({
					name: "Test",
					lastName: "Test",
					username: `test${Date.now()}`,
					age: 8,
					sex: "M",
					birthDate: "2018-01-01",
					classroomName: "class1T1"
				});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("inserted");
			studentId = response.body.inserted.insertId;
		});
	});

	describe("PUT /students/:studentId", () => {
		it("should update a student with valid data", async () => {
			const response = await request(app)
				.put(`/students/${ studentId }`)
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 7, classroomId: 1 });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("student");
		});
	});

	describe("GET /students/currentStudent", () => {
		it("should get current student data", async () => {
			const response = await request(app)
				.get("/students/currentStudent")
				.set("Authorization", `Bearer ${ studentToken }`)
				.set("role", "student");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("id", 1);
			expect(response.body).toHaveProperty("username", "maria1");
			expect(response.body).toHaveProperty("name", "María");
		});
	});

	describe("GET /students/:studentId", () => {
		it("should get student data by ID", async () => {
			const response = await request(app)
				.get("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("id", 1);
			expect(response.body).toHaveProperty("username", "maria1");
			expect(response.body).toHaveProperty("name", "María");
		});

		it("should return 404 if student does not exist", async () => {
			const response = await request(app)
				.get("/students/999")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});

	describe("GET /students/list/:classroomName", () => {
		it("should list students for a valid classroom", async () => {
			const response = await request(app)
				.get("/students/list/class1T1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);

		});

		it("should return 404 if no students exist in the classroom", async () => {
			const response = await request(app)
				.get("/students/list/3C")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});

	describe("DELETE /students/:studentId", () => {
		it("should delete a student with valid data", async () => {
			const response = await request(app)
				.delete(`/students/${ studentId }`)
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);
			expect(response.body).toEqual({ deleted: true });
		});

		it("should return 404 if student does not exist", async () => {
			const response = await request(app)
				.delete(`/students/${ studentId }`)
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});
});