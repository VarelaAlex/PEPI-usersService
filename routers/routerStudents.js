const express = require("express");
const database = require("../database");
const {
	      generateTokens, authenticateToken, isStudent, isTeacher
      } = require("../auth");
require("dotenv").config();

let generateUsername = (name, lastName, classroomName) => {
	/**
	let cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, "");
	let cleanLastName = lastName.normalize("NFD")
	                            .replace(/[\u0300-\u036f]/g, "")
	                            .trim()
	                            .toLowerCase()
	                            .replace(/\s+/g, "");
	return cleanName + cleanLastName.charAt(0) + classroomNumber;
	 */
	return `${name.split(" ")[0]}${lastName.split(" ")[0]}${classroomName}`;
};

const routerStudents = express.Router();

routerStudents.post("/login", async (req, res) => {

	let { username } = req.body;

	if ( !username?.trim() ) {
		return res.status(400).json({ error: { username: "login.error.username.empty" } });
	}

	let response = null;
	try {
		response = await database.query("SELECT id, username, name FROM students WHERE username = ?", [username]);

		if ( !response[ 0 ] || !response[ 0 ].username || response[ 0 ].username.length <= 0 ) {
			return res.status(404).json({ error: { email: "login.error.username.notExist" } });
		}
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	let user = {
		username: response[ 0 ].username, id: response[ 0 ].id, role: "student"
	};

	let tokens = generateTokens(user);

	try {
		await database.query("INSERT INTO refreshTokens (refreshToken) VALUES (?)", [tokens.refreshToken]);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	res.status(200).json({
		                     accessToken:  tokens.accessToken,
		                     refreshToken: tokens.refreshToken,
		                     name:         response[ 0 ].name,
							 id: response[0].id,
							 username:  response[ 0 ].username
	                     });
});

routerStudents.post("/", authenticateToken, isTeacher, async (req, res) => {
	let {
		    name,
		    lastName,
		    age,
		    classroomName,
		    school,
		    classroomNumber,
		    birthDate,
		    socioEconomicLevel,
		    nationalOrigin,
		    otherNationalOrigin,
		    learningReadingRisk,
		    learningWritingRisk,
		    familyBackground,
		    specificSupportNeeds,
		    otherSpecificSupportNeeds,
		    learningDiagnosedDifficulties,
		    educationalSupport,
		    otherEducationalSupport,
		    firstWords
	    } = req.body;

	let teacherId = req.user?.id;

	// Basic validation for required fields
	if ( !name?.trim() ) {
		return res.status(400).json({ error: { name: "classrooms.detail.create.error.name.empty" } });
	}

	if ( !lastName?.trim() ) {
		return res.status(400).json({ error: { lastName: "classrooms.detail.create.error.lastName.empty" } });
	}

	if ( !age ) {
		return res.status(400).json({ error: { age: "classrooms.detail.create.error.age.empty" } });
	}

	if ( age < 0 ) {
		return res.status(400).json({ error: { age: "classrooms.detail.create.error.age.negative" } });
	}

	if ( !classroomName?.trim() ) {
		return res.status(400).json({ error: { classroomName: "classrooms.detail.create.error.classroom.empty" } });
	}

	// Validate birthDate format
	if ( !birthDate || isNaN(new Date(birthDate).getTime()) ) {
		return res.status(400).json({ error: { birthDate: "classrooms.detail.create.error.birthDate.invalid" } });
	} else {
		birthDate = birthDate.split("T")[ 0 ];
	}

	if ( learningReadingRisk ) {
		learningReadingRisk = learningReadingRisk === "si";
	}

	if ( learningWritingRisk ) {
		learningWritingRisk = learningWritingRisk === "si";
	}

	// Process `otherSpecificSupportNeeds`
	if ( otherSpecificSupportNeeds && Array.isArray(otherSpecificSupportNeeds) ) {
		if ( !specificSupportNeeds.includes("otro") ) {
			otherSpecificSupportNeeds = null;
		} else {
			otherSpecificSupportNeeds = otherSpecificSupportNeeds.join(";");
		}
	}

	// Process `specificSupportNeeds`
	if ( specificSupportNeeds && Array.isArray(specificSupportNeeds) ) {
		specificSupportNeeds =
			specificSupportNeeds.filter(e => (
				e !== "otro"
			)).join(";");
	}

	// Process `otherEducationalSupport`
	if ( otherEducationalSupport && Array.isArray(otherEducationalSupport) ) {
		if ( !educationalSupport.includes("otros") ) {
			otherEducationalSupport = null;
		} else {
			otherEducationalSupport = otherEducationalSupport.join(";");
		}
	}

	// Process `educationalSupport`
	if ( educationalSupport && Array.isArray(educationalSupport) ) {
		educationalSupport =
			educationalSupport.filter(e => (
				e !== "otros"
			)).join(";");
	}

	// Process 'learningDiagnosedDifficulties'
	if ( learningDiagnosedDifficulties && Array.isArray(learningDiagnosedDifficulties) ) {
		learningDiagnosedDifficulties = learningDiagnosedDifficulties.join(";");
	}

	// Generate username
	let username = generateUsername(name, lastName, classroomName);

	let response = null;
	try {
		// Retrieve classroom ID
		let classroomResult = await database.query(
			"SELECT id FROM classrooms WHERE name = ? AND teacherId = ?",
			[classroomName, teacherId]
		);
		if ( classroomResult.length === 0 ) {
			return res.status(400).json({ error: { classroom: "classrooms.detail.create.error.classroom.notFound" } });
		}

		let classroomId = classroomResult[ 0 ].id;

		// Handle nationalOrigin 'other' case
		nationalOrigin = nationalOrigin === "otro" ? otherNationalOrigin : nationalOrigin;

		// Insert student into the database
		response = await database.query(
			"INSERT INTO students (username, name, lastName, age, school, classroomNumber, birthDate, classroomId, socioEconomicLevel, nationalOrigin, learningReadingRisk, learningWritingRisk, familyBackground, specificSupportNeeds, otherSpecificSupportNeeds, learningDiagnosedDifficulties, educationalSupport, otherEducationalSupport, firstWords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
			[
				username,
				name,
				lastName,
				age,
				school,
				classroomNumber,
				birthDate,
				classroomId,
				socioEconomicLevel || null,
				nationalOrigin || null,
				learningReadingRisk,
				learningWritingRisk,
				familyBackground,
				specificSupportNeeds,
				otherSpecificSupportNeeds,
				learningDiagnosedDifficulties,
				educationalSupport,
				otherEducationalSupport,
				firstWords
			]
		);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e.message || e } });
	}

	// Respond with the result of the insert
	res.status(200).json({ inserted: response });
});

routerStudents.get("/pretrainingPhase", authenticateToken, isStudent, async (req, res) => {

    let studentId = req.user.id;

    try {
        result = await database.query("SELECT s.pretrainingPhase FROM students s where s.id = ?", [studentId]);
    }
    catch ( e ) {
        return res.status(500).json({ error: { type: "internalServerError", message: e } });
    }
    finally {

    }

    if ( result.length <= 0 ) {
        return res.status(500).json({ error: { type: "internalServerError" } });
    }

    res.status(200).json(result[ 0 ]);
});

routerStudents.put("/pretrainingPhase", authenticateToken, isStudent, async (req, res) => {
    const studentId = req.user.id;
    const { pretrainingPhase } = req.body;

    // Validación básica
    if (pretrainingPhase === undefined) {
        return res.status(400).json({ error: { type: "badRequest", message: "Missing pretrainingPhase value" } });
    }

    try {
        const [result] = await database.query(
            "UPDATE students SET pretrainingPhase = ? WHERE id = ?",
            [pretrainingPhase, studentId]
        );

        // Comprobamos si realmente se modificó algo
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: { type: "notFound", message: "Student not found" } });
        }

        return res.status(200).json({ message: "pretrainingPhase updated successfully" });
    }
    catch (e) {
        return res.status(500).json({ error: { type: "internalServerError", message: e.message } });
    }
});

routerStudents.put("/:studentId", authenticateToken, isTeacher, async (req, res) => {
	let { studentId } = req.params;
	let {
		    name,
		    lastName,
		    age,
		    classroomId,
		    school,
		    classroomNumber,
		    birthDate,
		    socioEconomicLevel,
		    nationalOrigin,
		    otherNationalOrigin,
		    learningReadingRisk,
		    learningWritingRisk,
		    familyBackground,
		    specificSupportNeeds,
		    otherSpecificSupportNeeds,
		    learningDiagnosedDifficulties,
		    educationalSupport,
		    otherEducationalSupport,
		    firstWords
	    } = req.body;

	// Validate `studentId`
	if ( !studentId?.trim() ) {
		return res.status(400).json({ error: { id: "classrooms.detail.update.error.id" } });
	}

	// Validate `name`
	if ( name !== undefined && !name?.trim() ) {
		return res.status(400).json({ error: { name: "classrooms.detail.update.error.name.empty" } });
	}

	// Validate `lastName`
	if ( lastName !== undefined && !lastName?.trim() ) {
		return res.status(400).json({ error: { lastName: "classrooms.detail.update.error.lastName.empty" } });
	}

	// Validate `age`
	if ( age !== undefined ) {
		if ( !age || age < 0 ) {
			return res.status(400)
			          .json({
				                error: {
					                age: age < 0
					                     ? "classrooms.detail.update.error.age.negative"
					                     : "classrooms.detail.update.error.age.empty"
				                }
			                });
		}
	}

	// Validate `birthDate`
	if ( birthDate !== undefined ) {
		if ( !birthDate || isNaN(new Date(birthDate).getTime()) ) {
			return res.status(400).json({ error: { birthDate: "classrooms.detail.update.error.birthDate.invalid" } });
		} else {
			birthDate = birthDate.split("T")[ 0 ];
		}
	}

	// Validate `classroomId`
	if ( classroomId !== undefined && !classroomId ) {
		return res.status(400).json({ error: { classroomName: "classrooms.detail.update.error.classroom.empty" } });
	}

	// Validate and process `learningReadingRisk`
	if ( learningReadingRisk !== undefined ) {
		learningReadingRisk = learningReadingRisk === "si";
	}

	// Validate and process `learningWritingRisk`
	if ( learningWritingRisk !== undefined ) {
		learningWritingRisk = learningWritingRisk === "si";
	}

	// Process `otherSpecificSupportNeeds`
	if ( otherSpecificSupportNeeds && Array.isArray(otherSpecificSupportNeeds) ) {
		if ( !specificSupportNeeds.includes("otro") ) {
			otherSpecificSupportNeeds = null;
		}
	}

	// Process `specificSupportNeeds`
	if ( specificSupportNeeds && Array.isArray(specificSupportNeeds) ) {
		specificSupportNeeds =
			specificSupportNeeds.filter(e => (
				e !== "otro"
			)).join(";");
	}

	// Process `otherEducationalSupport`
	if ( otherEducationalSupport && Array.isArray(otherEducationalSupport) ) {
		if ( !educationalSupport.includes("otros") ) {
			otherEducationalSupport = null;
		} else {
			otherEducationalSupport = otherEducationalSupport.join(";");
		}
	}

	// Process `educationalSupport`
	if ( educationalSupport && Array.isArray(educationalSupport) ) {
		educationalSupport =
			educationalSupport.filter(e => (
				e !== "otros"
			)).join(";");
	}

	// Process 'learningDiagnosedDifficulties'
	if ( learningDiagnosedDifficulties && Array.isArray(learningDiagnosedDifficulties) ) {
		learningDiagnosedDifficulties = learningDiagnosedDifficulties.join(";");
	}

	// Handle `nationalOrigin`
	if ( nationalOrigin === "otro" ) {
		nationalOrigin = otherNationalOrigin;
	}

	let response = null;

	try {
		// Update the student in the database
		response = await database.query(`
            UPDATE students
            SET name                          = COALESCE(?, name),
                lastName                      = COALESCE(?, lastName),
                age                           = COALESCE(?, age),
                classroomId                   = COALESCE(?, classroomId),
                school                        = COALESCE(?, school),
                classroomNumber               = COALESCE(?, classroomNumber),
                birthDate                     = COALESCE(?, birthDate),
                socioEconomicLevel            = ?,
                nationalOrigin                = ?,
                learningReadingRisk           = ?,
                learningWritingRisk           = ?,
                familyBackground              = ?,
                specificSupportNeeds          = ?,
                otherSpecificSupportNeeds     = ?,
                learningDiagnosedDifficulties = ?,
                educationalSupport            = ?,
                otherEducationalSupport       = ?,
                firstWords                    = ?
            WHERE id = ?
		`, [
			   name,
			   lastName,
			   age,
			   classroomId,
			   school,
			   classroomNumber,
			   birthDate,
			   socioEconomicLevel,
			   nationalOrigin,
			   learningReadingRisk,
			   learningWritingRisk,
			   familyBackground,
			   specificSupportNeeds,
			   otherSpecificSupportNeeds,
			   learningDiagnosedDifficulties,
			   educationalSupport,
			   otherEducationalSupport,
			   firstWords,
			   studentId
		   ]);

		if ( response.affectedRows === 0 ) {
			return res.status(404).json({ error: { id: "classrooms.detail.update.error.notFound" } });
		}
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e.message || e } });
	}

	// Respond with the result of the update
	res.status(200).json({ updated: response });
});

routerStudents.delete("/:studentId", authenticateToken, isTeacher, async (req, res) => {

	let { studentId } = req.params;

	if ( !studentId ) {
		return res.status(400).json({ error: { id: "classrooms.detail.delete.error.id" } });
	}

	let result = null;

	try {
		result = await database.query("DELETE FROM students WHERE id = ?", [studentId]);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	if ( result.affectedRows === 0 ) {
		return res.status(404).json({ error: { classroom: "classrooms.detail.delete.error.notExist" } });
	}

	res.status(200).json({ deleted: true });
});

routerStudents.get("/checkLogin", authenticateToken, isStudent, async (req, res) => {
	return res.status(200).json({ user: req.user });
});

routerStudents.get("/currentStudent", authenticateToken, isStudent, async (req, res) => {

	let studentId = req.user.id;

	try {
		result = await database.query("SELECT s.* FROM students s where s.id = ?", [studentId]);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	if ( result.length <= 0 ) {
		return res.status(500).json({ error: { type: "internalServerError" } });
	}

	res.status(200).json(result[ 0 ]);
});

routerStudents.get("/:studentId", authenticateToken, isTeacher, async (req, res) => {

	let { studentId } = req.params;
	let teacherId = req.user.id;

	if ( !teacherId ) {
		return res.status(400).json({ error: { teacher: "classrooms.detail.error.teacher" } });
	}

	if ( !studentId ) {
		return res.status(400).json({ error: { id: "classrooms.detail.error.student" } });
	}

	let result = null;

	try {
		result = await database.query(
			"SELECT s.* FROM students s JOIN classrooms c ON c.id = s.classroomId JOIN teachers t ON t.id = c.teacherId WHERE s.id = ? AND t.id = ?",
			[studentId, teacherId]
		);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	if ( result.length <= 0 ) {
		return res.status(404).json({ error: { classroom: "classrooms.detail.error.notExist" } });
	}

	res.status(200).json(result[ 0 ]);
});

routerStudents.get("/list/:classroomName", authenticateToken, isTeacher, async (req, res) => {

	let { classroomName } = req.params;
	let teacherId = req.user.id;

	if ( !teacherId ) {
		return res.status(400).json({ error: { teacher: "classrooms.detail.error.teacher" } });
	}

	if ( !classroomName ) {
		return res.status(400).json({ error: { id: "classrooms.detail.error.classroom" } });
	}

	let result = null;

	try {
		result = await database.query(
			"SELECT s.username, s.id, s.name, s.lastName, s.age FROM students s JOIN classrooms c ON c.teacherId = ? WHERE c.name = ? AND s.classroomId = c.id",
			[teacherId, classroomName]
		);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	if ( result.length <= 0 ) {
		return res.status(404).json({ error: { classroom: "classrooms.detail.error.notExist" } });
	}

	res.status(200).json(result);
});

module.exports = routerStudents;