'use client'

import React from 'react'
import ProcedureForm from '@/components/forms/ProcedureForm'
import type { Patient, CathProcedure } from '@/lib/types'

interface CathProcedureModalProps {
  isOpen: boolean
  onClose: () => void
  patient: Patient
  procedureToEdit?: CathProcedure | null
  onSaved: () => void
}

export default function CathProcedureModal({
  isOpen,
  onClose,
  patient,
  procedureToEdit,
  onSaved
}: CathProcedureModalProps) {
  if (!isOpen) return null

  return (
    <ProcedureForm
      patient={patient}
      procedureToEdit={procedureToEdit}
      onClose={onClose}
      onSuccess={onSaved}
    />
  )
}
