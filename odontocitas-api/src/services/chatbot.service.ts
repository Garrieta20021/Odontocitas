import {
  buscarPacientePorTelefono,
  cancelarProximaCitaPaciente,
  consultarDisponibilidadOdontologo,
  consultarProximaCitaPaciente,
  crearCitaPaciente,
  reprogramarProximaCitaPaciente,
  type PacienteWA,
  type ResultadoCita,
} from './citas.service'

export { buscarPacientePorTelefono, type PacienteWA }

export async function crearCita(
  paciente: PacienteWA,
  datos: { fecha_hora?: string; especialidad?: string; tratamiento?: string; motivo?: string }
): Promise<ResultadoCita> {
  return crearCitaPaciente(paciente, datos)
}

export async function cancelarCita(paciente: PacienteWA): Promise<ResultadoCita> {
  return cancelarProximaCitaPaciente(paciente)
}

export async function reprogramarCita(
  paciente: PacienteWA,
  datos: { fecha_hora?: string }
): Promise<ResultadoCita> {
  return reprogramarProximaCitaPaciente(paciente, datos)
}

export async function consultarCita(paciente: PacienteWA): Promise<ResultadoCita> {
  return consultarProximaCitaPaciente(paciente)
}

export async function consultarDisponibilidad(fecha: string, especialidad?: string): Promise<ResultadoCita> {
  return consultarDisponibilidadOdontologo(fecha, especialidad)
}
