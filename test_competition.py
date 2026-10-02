import math
import unittest

def calcular_desviacion_estandar(valores):
    if not valores or len(valores) < 2:
        return 0.0
    n = len(valores)
    media = sum(valores) / n
    suma_cuadrados = sum((x - media) ** 2 for x in valores)
    return math.sqrt(suma_cuadrados / (n - 1))

def calcular_puntuaciones(participantes, factor_bono=0.20):
    procesados = []
    for p in participantes:
        peso_ini = p["peso_inicial"]
        cintura_ini = p["cintura_inicial"]
        peso_fin = p["peso_final"]
        cintura_fin = p["cintura_final"]
        check_ins = p.get("check_ins", [])

        pct_peso = ((peso_ini - peso_fin) / peso_ini) * 100.0
        cm_cintura = cintura_ini - cintura_fin
        bono_cintura = cm_cintura * factor_bono
        puntaje_final = pct_peso + bono_cintura

        pct_red_cintura = ((cintura_ini - cintura_fin) / cintura_ini) * 100.0
        total_checkins = len(check_ins)

        historial_pesos = [peso_ini] + check_ins
        std_dev = calcular_desviacion_estandar(historial_pesos)

        procesados.append({
            "nombre": p["nombre"],
            "puntaje_final": round(puntaje_final, 4),
            "pct_red_cintura": round(pct_red_cintura, 4),
            "pct_peso": round(pct_peso, 4),
            "total_checkins": total_checkins,
            "std_dev": round(std_dev, 4)
        })

    def key_sort(item):
        return (
            -item["puntaje_final"],
            -item["pct_red_cintura"],
            -item["pct_peso"],
            -item["total_checkins"],
            item["std_dev"]
        )

    procesados.sort(key=key_sort)
    for idx, p in enumerate(procesados):
        p["posicion"] = idx + 1
    return procesados


class TestCompetitionLogic(unittest.TestCase):

    def test_basic_scoring(self):
        part = [{
            "nombre": "Ana",
            "peso_inicial": 100.0,
            "cintura_inicial": 100.0,
            "peso_final": 90.0,
            "cintura_final": 90.0,
            "check_ins": [95.0, 92.0, 90.0]
        }]
        res = calcular_puntuaciones(part)
        self.assertEqual(res[0]["puntaje_final"], 12.0)

    def test_tiebreaker_a_waist_reduction_pct(self):
        parts = [
            {"nombre": "Bob", "peso_inicial": 200.0, "cintura_inicial": 200.0, "peso_final": 180.0, "cintura_final": 190.0, "check_ins": []},
            {"nombre": "Ana", "peso_inicial": 100.0, "cintura_inicial": 100.0, "peso_final": 90.0, "cintura_final": 90.0, "check_ins": []}
        ]
        res = calcular_puntuaciones(parts)
        self.assertEqual(res[0]["nombre"], "Ana")
        self.assertEqual(res[1]["nombre"], "Bob")

    def test_tiebreaker_c_checkins_count(self):
        parts = [
            {"nombre": "Daniel", "peso_inicial": 100.0, "cintura_inicial": 100.0, "peso_final": 90.0, "cintura_final": 90.0, "check_ins": [95.0]},
            {"nombre": "Carlos", "peso_inicial": 100.0, "cintura_inicial": 100.0, "peso_final": 90.0, "cintura_final": 90.0, "check_ins": [97.0, 95.0, 92.0]}
        ]
        res = calcular_puntuaciones(parts)
        self.assertEqual(res[0]["nombre"], "Carlos")

    def test_tiebreaker_d_std_dev(self):
        parts = [
            {"nombre": "Fernando", "peso_inicial": 100.0, "cintura_inicial": 100.0, "peso_final": 90.0, "cintura_final": 90.0, "check_ins": [110.0, 80.0, 90.0]},
            {"nombre": "Elena", "peso_inicial": 100.0, "cintura_inicial": 100.0, "peso_final": 90.0, "cintura_final": 90.0, "check_ins": [96.6, 93.3, 90.0]}
        ]
        res = calcular_puntuaciones(parts)
        self.assertEqual(res[0]["nombre"], "Elena")
        self.assertEqual(res[1]["nombre"], "Fernando")

    def test_optional_fields_validation(self):
        # Mandatory fields
        datos_registro = {
            "nombreCompleto": "Juan Pérez",
            "edad": 35,
            "sexo": "Masculino",
            "email": "", # Email is optional (empty string)
            "estatura": 1.75,
            "pesoInicial": 85.0,
            "cinturaInicial": 90.0,
            "fechaInicio": "2025-01-01",
            "categoria": "Sedentario/Sobrepeso"
        }

        # Ensure registration does not fail when optional email is empty
        obligatorios = ["nombreCompleto", "edad", "sexo", "estatura", "pesoInicial", "cinturaInicial", "fechaInicio", "categoria"]
        completo = all(datos_registro.get(k) not in [None, "", []] for k in obligatorios)
        self.assertTrue(completo)

if __name__ == "__main__":
    unittest.main()
