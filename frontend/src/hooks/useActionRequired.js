import { useState, useEffect } from "react";

export function useActionRequired() {
  return { data: [], loading: false, error: null };
}