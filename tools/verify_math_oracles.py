"""Check design reference values independently. Does NOT test an app implementation."""
import json, math, pathlib
from decimal import Decimal, localcontext
from fractions import Fraction
ROOT=pathlib.Path(__file__).resolve().parents[1]
def verify():
    vectors=json.loads((ROOT/'examples/math_vectors.json').read_text())
    for case in vectors['scoring']:
        f=Fraction;own=f(case['own_price']);best=min([own]+[f(x) for x in case['rivals']]);w=f(case['max_points'])
        if case['template']=='proportional_inverse':value=w*best/own
        elif case['template']=='linear_discount':
            reference=f(case['reference_price']);denominator=reference-best
            if denominator==0:
                assert case['expected_score'] is None;continue
            value=w*(reference-own)/denominator
        else:
            value=float(w)*(1+math.log10(float(best/own)))
        if isinstance(value,Fraction):
            with localcontext() as c:
                c.prec=40;actual=Decimal(value.numerator)/Decimal(value.denominator)
        else:actual=Decimal(str(value))
        assert abs(actual-Decimal(case['expected_score']))<Decimal('0.0000000001'),case['id']
    for case in vectors['tias_demo']:
        b=Decimal('118336.00');p=(b*(1-Decimal(case['discount_rate']))).quantize(Decimal('.01'))
        assert str(p)==case['expected_price_net']
        assert p-Decimal('90000')==Decimal(case['expected_profit_net'])
        assert abs((p-Decimal('90000'))/p-Decimal(case['expected_margin_rate']))<Decimal('1e-11')
    # Independent exact checks for published-rule boundary examples.
    assert not Fraction(75)<Fraction(3,4)*100
    assert Fraction('74.99')<Fraction(3,4)*100
    assert not Fraction(80)<Fraction(4,5)*100
    assert Fraction('79.99')<Fraction(4,5)*100
    assert sum(map(Fraction,[70,90]))/2==80
    assert Fraction(9,10)*(sum(map(Fraction,[40,41,100]))/3)==Fraction('54.3')
    print('PASS: scoring vectors, demo money/margins and exact boundary oracles; app not tested')
if __name__=='__main__':verify()
