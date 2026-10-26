"""The same canonical declarative rules used by the JavaScript MCP engine."""
def scalar(rule,item,value,firmware,protocol):
    if type(value)!=int:raise ValueError('Exact raw integer required')
    if rule['status']!='resolved':raise ValueError(rule.get('reason','Unresolved source semantics'))
    size=item['width'];signed=rule.get('encoding')=='twos-complement';lo=-(1<<(size*8-1))if signed else 0;hi=(1<<(size*8-1))-1 if signed else(1<<(size*8))-1
    if not lo<=value<=hi:raise ValueError('Raw value exceeds width/encoding')
    if firmware<rule.get('minimumFirmware',0):raise ValueError('Unsupported item firmware')
    if rule.get('protocols')and protocol not in rule['protocols']:raise ValueError('Item unavailable with this protocol')
    if rule.get('values')is not None and value not in rule['values']:raise ValueError('Undocumented enum/sentinel')
    if rule.get('bounds')and not rule['bounds'][0]<=value<=rule['bounds'][1]:raise ValueError('Value outside documented raw range')
    if 'allowedMask'in rule and value&~rule['allowedMask']:raise ValueError('Reserved control bits must remain zero')
    for bit,since in rule.get('bitMinimumFirmware',{}).items():
        if value&int(bit)and firmware<since:raise ValueError('Requested bit requires newer firmware')
def live(rule,value,read,firmware,protocol,has_item=lambda n:True,peer_read=None):
    observed={};effects=[]
    def get(name):
        if name not in observed:observed[name]=read(name)
        return observed[name]
    def when(c):
        if 'all'in c:return all(when(x)for x in c['all'])
        if 'any'in c:return any(when(x)for x in c['any'])
        if firmware<c.get('firmwareAtLeast',0):return False
        if c.get('protocols')and protocol not in c['protocols']:return False
        if c.get('item'):
            if not has_item(c['item']):return False
            actual=get(c['item']);actual=actual&c['mask']if'mask'in c else actual
            if 'equals'in c and actual!=c['equals']:return False
            if 'notEquals'in c and actual==c['notEquals']:return False
            if 'in'in c and actual not in c['in']:return False
        return True
    def expression(e):return e['constant']if'constant'in e else get(e['item'])*e.get('sign',1)
    def check_range(r):
        if r.get('bounds')and not r['bounds'][0]<=value<=r['bounds'][1]:raise ValueError('Value outside documented mode-dependent bounds')
        if r.get('rangeExpressions'):
            x=r['rangeExpressions']
            if not expression(x['lower'])<=value<=expression(x['upper']):raise ValueError('Value exceeds observed documented bounds')
        if firmware<r.get('minimumFirmware',0):raise ValueError('Configured feature requires newer firmware')
        if r.get('effect'):effects.append(r['effect'])
    if rule.get('requiresTorqueOff'):
        if get('Torque Enable')!=0:raise ValueError('Item requires torque already off')
        if peer_read:peer_read('Torque Enable',0)
    if rule.get('requiresLockZero')and has_item('Lock')and get('Lock')!=0:raise ValueError('EEPROM lock is active')
    if rule.get('requiresMode'):
        mode=get('Operating Mode')
        if mode not in rule['modes']:raise ValueError('Item unsupported in observed mode')
        if rule.get('modeBounds'):
            r=rule['modeBounds'][str(mode)];check_range({'rangeExpressions':{'lower':{'item':r['minItem']},'upper':{'item':r['maxItem']}}}if'minItem'in r else{'bounds':[r['min'],r['max']]})
    if rule.get('dynamicLimit')and abs(value)>get(rule['dynamicLimit']):raise ValueError('Goal exceeds observed dynamic limit')
    check_range(rule)
    for c in rule.get('cases',[]):
        if when(c['when']):check_range(c);break
    for name,values in rule.get('requiresItems',{}).items():
        if get(name)not in values:raise ValueError('Documented access condition is not satisfied')
    for name,values in rule.get('forbiddenStates',{}).items():
        if get(name)in values:raise ValueError('Controller state makes item unavailable')
    for c in rule.get('conditionalForbiddenRawStates',[]):
        if firmware>=c.get('minimumFirmware',0)and has_item(c['item'])and get(c['item'])in c['values']:raise ValueError('Documented error makes item read-only')
    for name,values in rule.get('forbiddenRawStates',{}).items():
        if get(name)in values:raise ValueError('Documented error makes item read-only')
    if rule.get('latch'):
        l=rule['latch']
        if get(l['item'])==l['lockedValue']and value==l['cannotWrite']:raise ValueError('Latch requires a power cycle')
    return {'observed':observed,'effects':effects}
