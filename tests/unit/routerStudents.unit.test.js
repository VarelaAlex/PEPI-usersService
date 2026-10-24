const request = require("supertest");
const express = require("express");
const routerStudents = require("../../routers/routerStudents");
const { generateTokens } = require("../../auth");

jest.mock("../../database");
jest.mock("../../auth");

const database = require("../../database");
const { authenticateToken, isTeacher, isStudent } = require("../../auth");

const app = express();
app.use(express.json());
app.use("/students", routerStudents);

describe("Students Router", () => {
	let teacherToken;
	let studentToken;

	beforeAll(() => {

		authenticateToken.mockImplementation((req, res, next) => {
			req.user = { id: 1, role: req.headers[ "role" ] };
			next();
		});

		isTeacher.mockImplementation((req, res, next) => {
			if ( req.user.role === "teacher" ) {
				next();
			} else {
				res.status(403).json({ error: "Forbidden" });
			}
		});

		isStudent.mockImplementation((req, res, next) => {
			if ( req.user.role === "student" ) {
				next();
			} else {
				res.status(403).json({ error: "Forbidden" });
			}
		});

		generateTokens.mockReturnValue({
			                               accessToken: "validAccessToken", refreshToken: "validRefreshToken"
		                               });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /students/login", () => {
		it("should login a student with valid username", async () => {
			database.query.mockResolvedValueOnce([{ id: 1, username: "aross123", name: "Angelica" }]);
			database.query.mockResolvedValueOnce({});

			const response = await request(app)
				.post("/students/login")
				.send({ username: "aross123" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("refreshToken");
			expect(response.body).toHaveProperty("name", "Angelica");
		});

		it("should return 400 if username is empty", async () => {
			const response = await request(app)
				.post("/students/login")
				.send({ username: "" });

			expect(response.status).toBe(400);
		});

		it("should return 404 if username does not exist", async () => {
			database.query.mockResolvedValueOnce([]);

			const response = await request(app)
				.post("/students/login")
				.send({ username: "nonexistent" });

			expect(response.status).toBe(404);
		});
	});

	describe("POST /students", () => {
		it("should create a student with valid data", async () => {
			database.query.mockResolvedValueOnce([]);
			database.query.mockResolvedValueOnce([{ id: 1 }]);
			database.query.mockResolvedValueOnce({ insertId: 1 });

			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({
					name: "Angelica",
					lastName: "Ross",
					username: "angelica123",
					age: 3,
					sex: "F",
					birthDate: "2020-01-01",
					classroomName: "3C"
				});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("inserted");
		});

		it("should return 400 if username is missing", async () => {
			const response = await request(app)
				.post("/students")
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 3, classroomName: "3C" });

			expect(response.status).toBe(400);
			expect(response.body.error).toHaveProperty("username");
		});

		it("should return 409 if username already exists", async () => {
			database.query.mockResolvedValueOnce([{ id: 2 }]);

			const response = await request(app)
				.post("/students")
				.set("role", "teacher")
				.send({
					name: "Angelica",
					lastName: "Ross",
					username: "angelica123",
					age: 3,
					sex: "F",
					birthDate: "2020-01-01",
					classroomName: "3C"
				});

			expect(response.status).toBe(409);
			expect(response.body.error).toHaveProperty("username");
		});

		it("should return 409 if username is claimed during insertion", async () => {
			database.query.mockResolvedValueOnce([]);
			database.query.mockResolvedValueOnce([{ id: 1 }]);
			database.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });

			const response = await request(app)
				.post("/students")
				.set("role", "teacher")
				.send({
					name: "Angelica",
					lastName: "Ross",
					username: "angelica123",
					age: 3,
					sex: "F",
					birthDate: "2020-01-01",
					classroomName: "3C"
				});

			expect(response.status).toBe(409);
			expect(response.body.error).toHaveProperty("username");
		});

		it("should return 400 if name is empty", async () => {
			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "", lastName: "Ross", age: 3, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if lastName is empty", async () => {
			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "", age: 3, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if age is negative", async () => {
			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: -1, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if age is empty", async () => {
			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if classroomName is empty", async () => {
			const response = await request(app)
				.post("/students")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 3, classroomName: "" });

			expect(response.status).toBe(400);
		});
	});

	describe("PUT /students/:studentId", () => {
		it("should update a student with valid data", async () => {
			database.query.mockResolvedValueOnce({ affectedRows: 1 });

			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 7, classroomId: 1 });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("student");
		});

		it("should return 400 if studentId is missing", async () => {
			const response = await request(app)
				.put("/students/%20") // %20 represents a space character
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 7, classroomId: 1 });

			expect(response.status).toBe(400);
		});

		it("should return 400 if name is empty", async () => {
			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "", lastName: "Ross", age: 3, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if lastName is empty", async () => {
			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "", age: 3, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if age is negative", async () => {
			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: -1, classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if age is empty", async () => {
			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", classroomName: "3C" });

			expect(response.status).toBe(400);
		});

		it("should return 400 if classroomId is missing", async () => {
			const response = await request(app)
				.put("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher")
				.send({ name: "Angelica", lastName: "Ross", age: 7 });

			expect(response.status).toBe(400);
		});
	});

	describe("DELETE /students/:studentId", () => {
		it("should delete a student with valid data", async () => {
			database.query.mockResolvedValueOnce({ affectedRows: 1 });

			const response = await request(app)
				.delete("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);
			expect(response.body).toEqual({ deleted: true });
		});

		it("should return 404 if student does not exist", async () => {
			database.query.mockResolvedValueOnce({ affectedRows: 0 });

			const response = await request(app)
				.delete("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});

	describe("GET /students/checkLogin", () => {
		it("should check login for a student", async () => {
			const response = await request(app)
				.get("/students/checkLogin")
				.set("Authorization", `Bearer ${ studentToken }`)
				.set("role", "student");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("user");
		});
	});

	describe("GET /students/currentStudent", () => {
		it("should get current student data", async () => {
			database.query.mockResolvedValueOnce([{ id: 2, username: "aross123", name: "Angelica" }]);

			const response = await request(app)
				.get("/students/currentStudent")
				.set("Authorization", `Bearer ${ studentToken }`)
				.set("role", "student");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("id", 2);
			expect(response.body).toHaveProperty("username", "aross123");
			expect(response.body).toHaveProperty("name", "Angelica");
		});
	});

	describe("GET /students/:studentId", () => {
		it("should get student data by ID", async () => {
			database.query.mockResolvedValueOnce([{ id: 1, username: "aross123", name: "Angelica" }]);

			const response = await request(app)
				.get("/students/1")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("id", 1);
			expect(response.body).toHaveProperty("username", "aross123");
			expect(response.body).toHaveProperty("name", "Angelica");
		});

		it("should return 404 if student does not exist", async () => {
			database.query.mockResolvedValueOnce([]);

			const response = await request(app)
				.get("/students/999")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});

	describe("GET /students/list/:classroomName", () => {
		it("should list students for a valid classroom", async () => {
			database.query.mockResolvedValueOnce([
				                                     {
					                                     username: "aross123",
					                                     id:       1,
					                                     name:     "Angelica",
					                                     lastName: "Ross",
					                                     age:      3
				                                     }, {
					username: "alovelace456", id: 2, name: "Ada", lastName: "Lovelace", age: 4
				}
			                                     ]);

			const response = await request(app)
				.get("/students/list/3C")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(200);
			expect(response.body).toEqual([
				                              {
					                              username: "aross123",
					                              id:       1,
					                              name:     "Angelica",
					                              lastName: "Ross",
					                              age:      3
				                              }, {
					username: "alovelace456", id: 2, name: "Ada", lastName: "Lovelace", age: 4
				}
			                              ]);
		});

		it("should return 404 if no students exist in the classroom", async () => {
			database.query.mockResolvedValueOnce([]);

			const response = await request(app)
				.get("/students/list/3C")
				.set("Authorization", `Bearer ${ teacherToken }`)
				.set("role", "teacher");

			expect(response.status).toBe(404);
		});
	});
});