'use strict';

const express = require('express');
const router = require('./indexProjects.js');
const sql = require('mssql');
const db = require('../bin/db.js');


router.get('/projects/:projId/users', async (req, res) => {
	try {
		const login = req.session.user;
		if (login === undefined)
			res.json({error: "You are not logged!"});
		else 
		{
			const projId = Number(req.params.projId);
			const users = await db.getUsersOfProject(projId);
			let projUsers = [{username: login}];
			let isUserPresentInProj = false;
			for (let i = 0; i < users.length; i++)
				if (users[i].username !== login)
						projUsers.push({username: users[i].username});
				else
					isUserPresentInProj = true;
			if (!isUserPresentInProj)
				res.json({error: "You are not in that project!"});
			else
				res.json({error: null, users: projUsers});
		}
	} catch (err) {
		console.log(err);
		res.json({error: 'Iternal error!'});
	}
});

router.post('/projects/:projId/users', async (req, res) => {
	try {
		const login = req.session.user;
		if (login === undefined)
			res.json({error: "You are not logged!"});
		else
		{
			const projId = Number(req.params.projId);
			if (isNaN(projId))
				res.json({error: "Invalid project ID!"});
			else
			{
				const username = req.body.username;
				if (!(await db.isUserInTheProject(login, projId)))
					res.json({error: "You are not in this project!"});
				else
				{
					if (db.getUserByUsername(username) === null)
						res.json({error: "Such user does not exist!"});
					else
					{
						if (await db.isUserInTheProject(username, projId))
							res.json({error: "That user already in this project!"});
						else
						{
							const pool = new sql.ConnectionPool(db.config);
							try {
								await pool.connect();
								await pool.request()
								.input('username', sql.VarChar(20), username)
								.input('projId', sql.Int, projId)
								.query('insert into usersProjects (username, projectId) values (@username, @projId)');
								res.json({error: null, username: username});
								pool.close();
							} catch (err) {
								pool.close();
								throw err;
							}
						}
					}
				}
			}
		}
	} catch (err) {
		console.log(err);
		res.json({error: 'Iternal error!'});
	}
});

router.delete('/projects/:projId/users/:username', async (req, res) => {
	try {
		const login = req.session.user;
		if (login === undefined)
			res.json({error: 'You are not logged!'});
		else
		{
			const projId = Number(req.params.projId);
			if (isNaN(projId))
				res.json({error : 'Invalid project ID!'});
			else
			{
				const username = req.params.username;
					if (!(await db.isUserInTheProject(login, projId)))
						res.json({error: "You are not in this project!"});
					else 
					{
						if (!(await db.isUserInTheProject(username, projId)))
							res.json({error: "That user not in this project!"});
						else
						{
							const pool = new sql.ConnectionPool(db.config);
							try {
								await pool.connect();
								let transaction = pool.transaction();
								try {
									await transaction.begin();
									await transaction.request()
									.input('username', sql.VarChar(20), username)
									.input('projId', sql.Int, projId)
									.query('delete from usersProjects where (username = @username and projectId = @projId)');
									const result = await transaction.request()
									.input('projId', sql.Int, projId)
									.query('select * from usersProjects where projectId = @projId');
									if (result.recordset.length !== 0)
									{
										await transaction.commit();
										res.json({error: null, reload: login === username});
										pool.close();
									}
									else
									{
										await transaction.request()
										.input('projId', sql.Int, projId)
										.query('delete from tasks where projectId = @projId');
										await transaction.request()
										.input('projId', sql.Int, projId)
										.query('delete from projects where projectId = @projId');
										await transaction.commit();
										res.json({error: null, reload: login === username});
										pool.close();
									}
								} catch (err) {
									try {
										await transaction.rollback();
									} catch (err) {
										console.log(err);
									}
									throw (err);
								}
							} catch (err) {
								pool.close();
								throw(err);
							}
						}
					}
			}
		}
	} catch (err) {
		console.log(err);
		res.json({error: 'Iternal error!'});
	}
});

module.exports = router;