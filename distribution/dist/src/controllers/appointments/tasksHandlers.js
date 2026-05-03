"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTasks = exports.deleteTask = exports.updateTask = exports.getTask = exports.createTask = void 0;
const tasks_1 = __importDefault(require("../../models/appointments/tasks"));
const createTask = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const taskService = new tasks_1.default('tasks');
        const newTask = await taskService.create(tenantId, req.body);
        res.status(201).json({ status: typeof newTask === "number" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};
exports.createTask = createTask;
const getTask = async (req, res) => {
    const { id } = req.params;
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const taskService = new tasks_1.default('tasks');
        const task = await taskService.read(tenantId, Number(id));
        if (task) {
            res.status(200).json(task);
        }
        else {
            res.status(404).json({ error: 'Task not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch task' });
    }
};
exports.getTask = getTask;
const updateTask = async (req, res) => {
    const { id } = req.params;
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const taskService = new tasks_1.default('tasks');
        const updatedTask = await taskService.update(tenantId, Number(id), req.body);
        if (updatedTask) {
            res.status(200).json({ status: updatedTask });
        }
        else {
            res.status(404).json({ status: false, error: 'Task not found' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update task' });
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res) => {
    const { id } = req.params;
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const taskService = new tasks_1.default('tasks');
        const deletedRows = await taskService.delete(tenantId, Number(id));
        if (deletedRows) {
            res.status(204).end();
        }
        else {
            res.status(404).json({ error: 'Task not found' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
};
exports.deleteTask = deleteTask;
const listTasks = async (req, res) => {
    try {
        const { page = 1, count = 10, tenantId, sortby = 'DESC' } = req.query;
        const tenantIdNum = parseInt(tenantId, 10);
        const taskService = new tasks_1.default('tasks');
        const tasks = await taskService.list(tenantIdNum, page, count, sortby);
        res.status(200).json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};
exports.listTasks = listTasks;
