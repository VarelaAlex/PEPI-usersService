const express = require("express");
const database = require("../database");
const { authenticateToken, isTeacher } = require("../auth");
require("dotenv").config();

const routerSurveys = express.Router();

routerSurveys.post("/:surveyCode", authenticateToken, isTeacher, async (req, res) => {

	let { studentId, score, responses } = req.body;
	let teacherId = req.user.id;

	if ( !studentId ) {
		return res.status(400).json({ error: { studentId: "survey.error.studentId.required" } });
	}
	if ( !teacherId ) {
		return res.status(400).json({ error: { teacherId: "survey.error.teacherId.required" } });
	}
	if ( score !== 0 && !score ) {
		return res.status(400).json({ error: { score: "survey.error.score.required" } });
	}
	if ( score < 0 ) {
		return res.status(400).json({ error: { score: "survey.error.score.invalid" } });
	}
	if ( !responses ) {
		return res.status(400).json({ error: { responses: "survey.error.responses.required" } });
	}

	let datetime = new Date().toISOString().slice(0, 19).replace("T", " ");

	// Construir dinámicamente los campos y valores para el INSERT
	const baseFields = ['studentId', 'teacherId', 'score', 'date', 'surveyCode'];
	const baseValues = [parseInt(studentId), teacherId, score, datetime, req.params.surveyCode];

	// Agregar cada respuesta como un campo individual
	const responseFields = Object.keys(responses);
	const responseValues = Object.values(responses);

	const allFields = [...baseFields, ...responseFields];
	const allValues = [...baseValues, ...responseValues];

	// Crear los placeholders para la query (?, ?, ?, ...)
	const placeholders = allFields.map(() => '?').join(',');
	const fieldNames = allFields.join(',');

	const query = `INSERT INTO surveys (${fieldNames}) VALUES (${placeholders})`;

	let response = null;
	try {
		response = await database.query(query, allValues);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	res.status(200).json({ inserted: response });
});

routerSurveys.put("/:surveyId/:surveyCode", authenticateToken, isTeacher, async (req, res) => {

	const { surveyId, surveyCode } = req.params;
	let { score, responses } = req.body;
	let teacherId = req.user.id;

	if (!surveyId) {
		return res.status(400).json({ error: { surveyId: "survey.error.surveyId.required" } });
	}

	if (!teacherId) {
		return res.status(400).json({ error: { teacherId: "survey.error.teacherId.required" } });
	}

	if (score !== 0 && !score) {
		return res.status(400).json({ error: { score: "survey.error.score.required" } });
	}

	if (score < 0) {
		return res.status(400).json({ error: { score: "survey.error.score.invalid" } });
	}

	if (!responses || typeof responses !== "object") {
		return res.status(400).json({ error: { responses: "survey.error.responses.required" } });
	}

	// Campos base que siempre se actualizan
	const fields = ["score"];
	const values = [score];

	// Campos dinámicos (respuestas)
	for (const [key, value] of Object.entries(responses)) {
		fields.push(key);
		values.push(value);
	}

	// Construcción dinámica del SET
	const setClause = fields.map(field => `${field} = ?`).join(", ");

	const query = `
		UPDATE surveys
		SET ${setClause}
		WHERE id = ? AND surveyCode = ? AND teacherId = ?
	`;

	values.push(surveyId, surveyCode, teacherId);

	let result;
	try {
		result = await database.query(query, values);
	} catch (e) {
		return res.status(500).json({
			error: { type: "internalServerError", message: e }
		});
	}

	if (result.affectedRows === 0) {
		return res.status(404).json({
			error: { type: "notFound", message: "survey.error.notFound" }
		});
	}

	res.status(200).json({ updated: true });
});

routerSurveys.get("/:studentId/:surveyCode", authenticateToken, isTeacher, async (req, res) => {
	let result = null;
	let { studentId, surveyCode } = req.params;

	try {
		result = await database.query(
			"SELECT s.* FROM surveys s WHERE s.studentId = ? AND surveyCode = ? ORDER BY date DESC LIMIT 1",
			[studentId, surveyCode]
		);
	}
	catch ( e ) {
		return res.status(500).json({ error: { type: "internalServerError", message: e } });
	}
	finally {

	}

	if (result && result.length <= 0 ) {
		return res.status(500).json({ error: { type: "internalServerError" } });
	}

	res.status(200).json(result[0]);
});

module.exports = routerSurveys;