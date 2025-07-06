from core.tests.base_test import BaseAPITestCase

from substation.models import County
from substation.models import Substation
from substation.models import DatasourceType
from substation.models import SubstationQueue
from substation.models import SubstationStatus
from substation.models import TransmissionLine
from substation.models import SubstationPolicyPortfolio


class SubstationAPITestCase(BaseAPITestCase):
    URL = "/api/v1/substations/"

    def setUp(self):
        super().setUp()
        self.substation = Substation.objects.bulk_create(
            [
                Substation(name="Test Substation 1", voltage=500),
                Substation(name="Test Substation 2", voltage=500),
            ]
        )

    def test_substation_list(self):
        self.set_auth(self.user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), len(self.substation))


class CountyAPITestCase(BaseAPITestCase):
    URL = "/api/v1/counties/"

    def setUp(self):
        super().setUp()
        self.county = County.objects.bulk_create(
            [County(name="Test County 1"), County(name="Test County 2")]
        )

    def test_county_list(self):
        self.set_auth(self.user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), len(self.county))


class SubstationFilterTestCase(BaseAPITestCase):
    URL = "/api/v1/substations/"

    def setUp(self):
        super().setUp()
        self.counties = County.objects.bulk_create(
            [County(name="Fresno"), County(name="Kern")]
        )
        self.substations = Substation.objects.bulk_create(
            [
                Substation(
                    name="AIRWAYS",
                    voltage=115,
                    county=self.counties[0],
                    study_region="PG&E FRESNO",
                    utility_area="PGAE",
                    interconnecting_entity="CAISO",
                ),
                Substation(
                    name="AIRCO",
                    voltage=230,
                    county=self.counties[1],
                    utility_area="PGAE",
                    interconnecting_entity="CAISO",
                    study_region="PG&E KERN",
                ),
            ]
        )

        for i, substation in enumerate(self.substations):

            SubstationStatus.objects.create(
                substation=substation,
                type=DatasourceType.HEATMAP,
                available_capacity=100 + i * 100,
                no_of_constraints=2 + i,
            )
            SubstationStatus.objects.create(
                substation=substation,
                type=DatasourceType.CONSTRAINT,
                available_capacity=200 + i * 100,
                no_of_constraints=4 + i,
            )
            SubstationQueue.objects.create(
                substation=substation,
                queue=200 + i * 100,
                no_of_projects=3 + i,
            )
            SubstationPolicyPortfolio.objects.create(
                substation=substation,
                policy_portfolio=300 + i * 100,
                year=2020 + i,
            )

    def request_and_assert_test_cases(self, url, test_cases):
        for test_case in test_cases:
            expected_count = test_case["count"]
            test_case.pop("count")
            self.set_auth(self.user)
            response = self.client.get(url, test_case)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data["data"]), expected_count)

    def test_substation_filter_by_name(self):
        test_cases = [
            {"name": " AIR ", "count": 2},
            {"name": "AIRC ", "count": 1},
            {"name": " AIRW", "count": 1},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_county(self):
        test_cases = [
            {"county__name": "FRE", "count": 1},
            {"county__name": "KERN", "count": 1},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_voltage(self):
        test_cases = [
            {"voltage_min": 110, "voltage_max": 120, "count": 1},
            {"voltage_min": 220, "voltage_max": 240, "count": 1},
            {"voltage_min": 110, "voltage_max": 240, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_study_region(self):
        test_cases = [
            {"study_region": " FRES", "count": 1},
            {"study_region": "KERN ", "count": 1},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_utility_area(self):
        test_cases = [
            {"utility_area": " PGAE ", "count": 2},
            {"utility_area": " PG", "count": 2},
            {"utility_area": "RTE ", "count": 0},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_interconnecting_entity(self):
        test_cases = [
            {"interconnecting_entity": "CAISO", "count": 2},
            {"interconnecting_entity": "CAI", "count": 2},
            {"interconnecting_entity": "WISO", "count": 0},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_available_capacity(self):
        test_cases = [
            {"available_capacity_min": 100, "available_capacity_max": 200, "count": 2},
            {"available_capacity_min": 200, "available_capacity_max": 300, "count": 2},
            {"available_capacity_min": 100, "available_capacity_max": 300, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_no_of_constraints(self):
        test_cases = [
            {"no_of_constraints_min": 2, "no_of_constraints_max": 3, "count": 2},
            {"no_of_constraints_min": 4, "no_of_constraints_max": 5, "count": 2},
            {"no_of_constraints_min": 2, "no_of_constraints_max": 5, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_queue(self):
        test_cases = [
            {"queue_min": 200, "queue_max": 300, "count": 2},
            {"queue_min": 300, "queue_max": 400, "count": 1},
            {"queue_min": 200, "queue_max": 400, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_no_of_projects(self):
        test_cases = [
            {"no_of_projects_min": 3, "no_of_projects_max": 4, "count": 2},
            {"no_of_projects_min": 5, "no_of_projects_max": 6, "count": 0},
            {"no_of_projects_min": 3, "no_of_projects_max": 6, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_policy_portfolio(self):
        test_cases = [
            {"policy_portfolio_min": 300, "policy_portfolio_max": 400, "count": 2},
            {"policy_portfolio_min": 400, "policy_portfolio_max": 500, "count": 1},
            {"policy_portfolio_min": 300, "policy_portfolio_max": 500, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_filter_by_year(self):
        test_cases = [
            {"year_min": 2020, "year_max": 2021, "count": 2},
            {"year_min": 2021, "year_max": 2022, "count": 1},
            {"year_min": 2020, "year_max": 2022, "count": 2},
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)

    def test_substation_combined_filters(self):
        test_cases = [
            # Test combining name and county
            {"name": "AIR", "county__name": "FRESNO", "count": 1},
            {"name": "AIR", "county__name": "KERN", "count": 1},
            # Test combining voltage range and study region
            {
                "voltage_min": 110,
                "voltage_max": 120,
                "study_region": "PG&E FRESNO",
                "count": 1,
            },
            {
                "voltage_min": 220,
                "voltage_max": 240,
                "study_region": "PG&E KERN",
                "count": 1,
            },
            # Test combining utility area and interconnecting entity
            {"utility_area": "PGAE", "interconnecting_entity": "CAISO", "count": 2},
            {"utility_area": "PGAE", "interconnecting_entity": "WISO", "count": 0},
            # Test combining available capacity range and number of constraints
            {
                "available_capacity_min": 100,
                "available_capacity_max": 300,
                "no_of_constraints_min": 2,
                "no_of_constraints_max": 4,
                "count": 2,
            },
            {
                "available_capacity_min": 200,
                "available_capacity_max": 300,
                "no_of_constraints_min": 4,
                "no_of_constraints_max": 5,
                "count": 2,
            },
            # Test combining queue and number of projects
            {
                "queue_min": 200,
                "queue_max": 400,
                "no_of_projects_min": 3,
                "no_of_projects_max": 6,
                "count": 2,
            },
            {
                "queue_min": 300,
                "queue_max": 400,
                "no_of_projects_min": 4,
                "no_of_projects_max": 6,
                "count": 1,
            },
            # Test combining policy portfolio range and year
            {
                "policy_portfolio_min": 300,
                "policy_portfolio_max": 400,
                "year_min": 2020,
                "year_max": 2021,
                "count": 2,
            },
            {
                "policy_portfolio_min": 400,
                "policy_portfolio_max": 500,
                "year_min": 2021,
                "year_max": 2022,
                "count": 1,
            },
        ]
        self.request_and_assert_test_cases(self.URL, test_cases)


class TransmissionLineAPITestCase(BaseAPITestCase):
    URL = "/api/v1/transmission-lines/"

    def setUp(self):
        super().setUp()
        self.transmission_lines = TransmissionLine.objects.bulk_create(
            [
                TransmissionLine(
                    name="Test Transmission Line 1",
                    voltage=500,
                    geo_coordinates="LINESTRING (0 0, 1 1)",
                ),
                TransmissionLine(
                    name="Test Transmission Line 2",
                    voltage=500,
                    geo_coordinates="LINESTRING (0 0, 1 1)",
                ),
            ]
        )

    def test_transmission_line_list(self):
        self.set_auth(self.user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), len(self.transmission_lines))
