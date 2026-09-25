import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.spatial_engine import haversine_distance

class KasaEdgeApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root_endpoint(self):
        """Root endpoint should return 200 and deliver HTML dashboard."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers.get("content-type", ""))

    def test_stats_endpoint(self):
        """Stats endpoint should return valid platform aggregation metrics."""
        response = self.client.get("/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("active_vehicles", data)
        self.assertIn("total_observations", data)
        self.assertIn("total_incidents", data)
        self.assertIn("civic_authority", data)
        self.assertEqual(data["civic_authority"], "Greater Bengaluru Authority (GBA)")

    def test_simulator_endpoints(self):
        """Simulator endpoints should provide step lifecycle controls."""
        status_res = self.client.get("/simulator/status")
        self.assertEqual(status_res.status_code, 200)
        status = status_res.json()
        self.assertIn("current_step", status)
        self.assertIn("total_steps", status)

    def test_gazetteer_endpoint(self):
        """Gazetteer endpoint should return known civic corridors."""
        response = self.client.get("/gazetteer")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("corridors", data)
        self.assertGreater(len(data["corridors"]), 0)

    def test_haversine_distance_computation(self):
        """Haversine distance should accurately measure spatial closeness."""
        # Indiranagar 100ft road coordinates (approx 10 meters apart)
        lat1, lon1 = 12.97190, 77.64120
        lat2, lon2 = 12.97195, 77.64125
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        self.assertGreater(dist, 0.0)
        self.assertLess(dist, 25.0)

if __name__ == "__main__":
    unittest.main()
