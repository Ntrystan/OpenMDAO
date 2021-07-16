"""
Unit tests for the semi-structured metamodel component.
"""
import itertools
import unittest

import numpy as np

import openmdao.api as om
from openmdao.components.tests.test_meta_model_structured_comp import SampleMap
from openmdao.utils.assert_utils import assert_near_equal, assert_check_partials


# Data for example used in the docs.

data_x = np.array([
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,

    1.3,
    1.3,
    1.3,
    1.3,
    1.3,

    1.6,
    1.6,
    1.6,
    1.6,
    1.6,

    2.1,
    2.1,
    2.1,
    2.1,
    2.1,

    2.5,
    2.5,
    2.5,
    2.5,
    2.5,
    2.5,

    2.9,
    2.9,
    2.9,
    2.9,
    2.9,

    3.2,
    3.2,
    3.2,
    3.2,

    3.6,
    3.6,
    3.6,
    3.6,
    3.6,
    3.6,

    4.3,
    4.3,
    4.3,
    4.3,

    4.6,
    4.6,
    4.6,
    4.6,
    4.6,
    4.6,

    4.9,
    4.9,
    4.9,
    4.9,
    4.9,
])

data_y = np.array([
    1.0,
    1.5,
    1.6,
    1.7,
    1.9,

    1.0,
    1.5,
    1.6,
    1.7,
    1.9,

    1.0,
    1.5,
    1.6,
    1.7,
    1.9,

    1.0,
    1.6,
    1.7,
    1.9,
    2.4,

    1.3,
    1.7,
    1.9,
    2.4,
    2.6,
    2.9,

    1.9,
    2.1,
    2.3,
    2.5,
    3.1,

    2.3,
    2.5,
    3.1,
    3.7,

    2.3,
    3.1,
    3.3,
    3.7,
    4.1,
    4.2,

    3.3,
    3.6,
    4.0,
    4.5,

    3.9,
    4.2,
    4.4,
    4.5,
    4.6,
    4.7,

    4.4,
    4.5,
    4.6,
    4.7,
    4.9,
])

data_values = 3.0 + np.sin(data_x*0.2) * np.cos(data_y*0.3)


class TestMetaModelStructuredScipy(unittest.TestCase):

    def test_vectorized_linear(self):
        # Test using the model we used for the Structured metamodel.
        prob = om.Problem()
        model = prob.model
        ivc = om.IndepVarComp()

        mapdata = SampleMap()

        params = mapdata.param_data
        x, y, _ = params
        outs = mapdata.output_data
        z = outs[0]
        ivc.add_output('x', np.array([x['default'], x['default'], x['default']]),
                       units=x['units'])
        ivc.add_output('y', np.array([y['default'], y['default'], y['default']]),
                       units=x['units'])
        ivc.add_output('z', np.array([z['default'], z['default'], z['default']]),
                       units=x['units'])

        model.add_subsystem('des_vars', ivc, promotes=["*"])

        comp = om.MetaModelSemiStructuredComp(method='slinear', extrapolate=True,
                                              training_data_gradients=True, vec_size=3)
        comp._no_check_partials = False  # override skipping of check_partials

        # Convert to the flat table format.
        grid = np.array(list(itertools.product(*[params[0]['values'],
                                                 params[1]['values'],
                                                 params[2]['values']])))

        j = 0
        for param in params:
            comp.add_input(param['name'], grid[:, j])
            j += 1

        for out in outs:
            comp.add_output(out['name'], outs[0]['values'].flatten())

        model.add_subsystem('comp', comp, promotes=["*"])

        prob.setup(force_alloc_complex=True)
        prob['x'] = np.array([1.0, 10.0, 90.0])
        prob['y'] = np.array([0.75, 0.81, 1.2])
        prob['z'] = np.array([-1.7, 1.1, 2.1])

        prob.run_model()

        partials = prob.check_partials(method='cs', out_stream=None)
        assert_check_partials(partials, rtol=1e-10)

    def test_vectorized_lagrange2(self):
        # Test using the model we used for the Structured metamodel.
        prob = om.Problem()
        model = prob.model
        ivc = om.IndepVarComp()

        mapdata = SampleMap()

        params = mapdata.param_data
        x, y, _ = params
        outs = mapdata.output_data
        z = outs[0]
        ivc.add_output('x', np.array([x['default'], x['default'], x['default']]),
                       units=x['units'])
        ivc.add_output('y', np.array([y['default'], y['default'], y['default']]),
                       units=x['units'])
        ivc.add_output('z', np.array([z['default'], z['default'], z['default']]),
                       units=x['units'])

        model.add_subsystem('des_vars', ivc, promotes=["*"])

        comp = om.MetaModelSemiStructuredComp(method='lagrange2', extrapolate=True,
                                              training_data_gradients=True, vec_size=3)
        comp._no_check_partials = False  # override skipping of check_partials

        # Convert to the flat table format.
        grid = np.array(list(itertools.product(*[params[0]['values'],
                                                 params[1]['values'],
                                                 params[2]['values']])))

        j = 0
        for param in params:
            comp.add_input(param['name'], grid[:, j])
            j += 1

        for out in outs:
            comp.add_output(out['name'], outs[0]['values'].flatten())

        model.add_subsystem('comp', comp, promotes=["*"])

        prob.setup(force_alloc_complex=True)
        prob['x'] = np.array([1.0, 10.0, 90.0])
        prob['y'] = np.array([0.75, 0.81, 1.2])
        prob['z'] = np.array([-1.7, 1.1, 2.1])

        prob.run_model()

        partials = prob.check_partials(method='cs', out_stream=None)
        assert_check_partials(partials, rtol=1e-10)

    def test_vectorized_lagrange3(self):
        # Test using the model we used for the Structured metamodel.
        prob = om.Problem()
        model = prob.model
        ivc = om.IndepVarComp()

        mapdata = SampleMap()

        params = mapdata.param_data
        x, y, _ = params
        outs = mapdata.output_data
        z = outs[0]
        ivc.add_output('x', np.array([x['default'], x['default'], x['default']]),
                       units=x['units'])
        ivc.add_output('y', np.array([y['default'], y['default'], y['default']]),
                       units=x['units'])
        ivc.add_output('z', np.array([z['default'], z['default'], z['default']]),
                       units=x['units'])

        model.add_subsystem('des_vars', ivc, promotes=["*"])

        comp = om.MetaModelSemiStructuredComp(method='lagrange3', extrapolate=True,
                                              training_data_gradients=True, vec_size=3)
        comp._no_check_partials = False  # override skipping of check_partials

        # Convert to the flat table format.
        grid = np.array(list(itertools.product(*[params[0]['values'],
                                                 params[1]['values'],
                                                 params[2]['values']])))

        j = 0
        for param in params:
            comp.add_input(param['name'], grid[:, j])
            j += 1

        for out in outs:
            comp.add_output(out['name'], outs[0]['values'].flatten())

        model.add_subsystem('comp', comp, promotes=["*"])

        prob.setup(force_alloc_complex=True)
        prob['x'] = np.array([1.0, 10.0, 90.0])
        prob['y'] = np.array([0.75, 0.81, 1.2])
        prob['z'] = np.array([-1.7, 1.1, 2.1])

        prob.run_model()

        partials = prob.check_partials(method='cs', out_stream=None)
        assert_check_partials(partials, rtol=1e-10)

    def test_vectorized_akima(self):
        # Test using the model we used for the Structured metamodel.
        prob = om.Problem()
        model = prob.model
        ivc = om.IndepVarComp()

        mapdata = SampleMap()

        params = mapdata.param_data
        x, y, _ = params
        outs = mapdata.output_data
        z = outs[0]
        ivc.add_output('x', np.array([x['default'], x['default'], x['default']]),
                       units=x['units'])
        ivc.add_output('y', np.array([y['default'], y['default'], y['default']]),
                       units=x['units'])
        ivc.add_output('z', np.array([z['default'], z['default'], z['default']]),
                       units=x['units'])

        model.add_subsystem('des_vars', ivc, promotes=["*"])

        comp = om.MetaModelSemiStructuredComp(method='akima', extrapolate=True,
                                              training_data_gradients=True, vec_size=3)
        comp._no_check_partials = False  # override skipping of check_partials

        # Convert to the flat table format.
        grid = np.array(list(itertools.product(*[params[0]['values'],
                                                 params[1]['values'],
                                                 params[2]['values']])))

        j = 0
        for param in params:
            comp.add_input(param['name'], grid[:, j])
            j += 1

        for out in outs:
            comp.add_output(out['name'], outs[0]['values'].flatten())

        model.add_subsystem('comp', comp, promotes=["*"])

        prob.setup(force_alloc_complex=True)
        prob['x'] = np.array([1.0, 10.0, 90.0])
        prob['y'] = np.array([0.75, 0.81, 1.2])
        prob['z'] = np.array([-1.7, 1.1, 2.1])

        prob.run_model()

        partials = prob.check_partials(method='cs', out_stream=None)
        assert_check_partials(partials, rtol=1e-10)

    def test_error_dim(self):
        x = np.array([1.0, 1.0, 2.0, 2.0])
        y = np.array([1.0, 2.0, 1.0, 2.0])
        f = np.array([1.0, 2.0, 3.0])

        comp = om.MetaModelSemiStructuredComp(method='akima')
        comp.add_input('x', x)
        comp.add_input('y', y)
        comp.add_output('f', f)

        prob = om.Problem()
        model = prob.model
        model.add_subsystem('comp', comp)

        msg = "Size mismatch: training data for 'f' is length 3, but" + \
            f" data for 'x' is length 4."
        with self.assertRaisesRegex(ValueError, msg):
            prob.setup()

    def test_list_input(self):
        x = [1.0, 1.0, 2.0, 2.0, 2.0]
        y = [1.0, 2.0, 1.0, 2.0, 3.0]
        f = [1.0, 2.5, 1.5, 4.0, 4.5]

        comp = om.MetaModelSemiStructuredComp(method='slinear', training_data_gradients=True)
        comp.add_input('x', x)
        comp.add_input('y', y)
        comp.add_output('f', f)

        prob = om.Problem()
        model = prob.model
        model.add_subsystem('comp', comp)

        prob.setup()

        prob.set_val('comp.x', 1.5)
        prob.set_val('comp.y', 1.5)

        prob.run_model()

        f = prob.get_val('comp.f')
        assert_near_equal(f, 2.25)

    def test_simple(self):
        prob = om.Problem()
        model = prob.model

        interp = om.MetaModelSemiStructuredComp(method='lagrange2', training_data_gradients=True)
        interp.add_input('x', data_x)
        interp.add_input('y', data_y)
        interp.add_output('f', data_values)

        # Sneak in a multi-output case.
        interp.add_output('g', 2.0 * data_values)

        model.add_subsystem('interp', interp)

        prob.setup(force_alloc_complex=True)

        prob.set_val('interp.x', np.array([3.1]))
        prob.set_val('interp.y', np.array([2.75]))

        prob.run_model()

        assert_near_equal(prob.get_val('interp.f'), 3.39415716, 1e-7)
        assert_near_equal(prob.get_val('interp.g'), 2.0 * 3.39415716, 1e-7)

    def test_simple_training_inputs(self):
        prob = om.Problem()
        model = prob.model

        interp = om.MetaModelSemiStructuredComp(method='lagrange2', training_data_gradients=True)
        interp.add_input('x', data_x)
        interp.add_input('y', data_y)
        interp.add_output('f', np.zeros(len(data_x)))

        model.add_subsystem('interp', interp)

        prob.setup(force_alloc_complex=True)

        prob.set_val('interp.x', np.array([3.1]))
        prob.set_val('interp.y', np.array([2.75]))

        prob.set_val('interp.f_train', data_values)

        prob.run_model()

        assert_near_equal(prob.get_val('interp.f'), 3.39415716, 1e-7)

if __name__ == "__main__":
    unittest.main()

