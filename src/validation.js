const { z } = require("zod");

const { AppError } = require("./errors");

const taskSchema = z.object({

  title: z.string()
    .trim()
    .min(1)
    .max(120),

  description: z.string()
    .trim()
    .max(2000)
    .optional()
    .default(""),

  status: z.enum([
    "pendiente",
    "en_progreso",
    "completada"
  ])
  .optional()
  .default("pendiente"),

  due_date: z.string()
    .date()
    .nullable()
    .optional()

}).strict();

const updateTaskSchema = taskSchema
  .partial()
  .strict()
  .refine(
    value => Object.keys(value).length > 0,
    "Debes enviar al menos un campo"
  );

function validate(schema, input) {

  const result = schema.safeParse(input);

  if (!result.success) {

    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Datos de entrada no válidos",

      result.error.issues.map(issue => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    );
  }

  return result.data;
}

module.exports = {
  taskSchema,
  updateTaskSchema,
  validate
};