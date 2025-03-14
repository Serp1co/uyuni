<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<%@ taglib uri="http://rhn.redhat.com/rhn" prefix="rhn" %>
<%@ taglib uri="http://rhn.redhat.com/tags/list" prefix="rl" %>
<%@ taglib uri="http://struts.apache.org/tags-bean" prefix="bean" %>
<%@ taglib uri="http://struts.apache.org/tags-html" prefix="html" %>


<html>
<body>
<%@ include file="/WEB-INF/pages/common/fragments/ssm/header.jspf" %>

<rhn:require acl="all_systems_in_set_have_feature(ftr_system_custom_values)">
    <a id="profiles" class="js-spa">&#160;</a>
    <h2><bean:message key="ssm.misc.index.csi.header"/></h2>
    <div class="page-summary">
      <p><a href="/rhn/systems/ssm/misc/CustomValue.do" class="js-spa"><bean:message key="ssm.misc.index.csi.summary"/></a></p>
    </div>
</rhn:require>

<rhn:require acl="user_role(org_admin); all_systems_in_set_have_feature(ftr_add_rm_addon_type)">
    <a id="entitle" class="js-spa">&#160;</a>
    <h2><bean:message key="ssm.misc.index.entitle.header"/></h2>
    <div class="page-summary">
        <p><strong><bean:message key="ssm.misc.index.entitle.summary"/></strong></p>
    </div>
</rhn:require>

<rhn:require acl="all_systems_in_set_have_feature(ftr_system_preferences)">
    <a id="sysprefs" class="js-spa">&#160;</a><h2><bean:message key="ssm.misc.index.syspref.header"/></h2>
    <div class="page-summary">
        <p><bean:message key="ssm.misc.index.syspref.summary"/></p>
    </div>

    <form action="/rhn/systems/ssm/misc/Index.do" method="post">
        <rhn:csrf />
        <rhn:submitted />

        <table width="96%" cellspacing="0" cellpadding="0" class="list" align="center">
            <thead>
                <tr>
                    <th align="left"><bean:message key="ssm.misc.index.syspref.preference"/></th>
                    <th width="5%" class="text-center"><bean:message key="yes"/></th>
                    <th width="5%" class="text-center"><bean:message key="no"/></th>
                    <th width="5%" class="text-center"><bean:message key="ssm.misc.index.syspref.nochange"/></th>
                </tr>
            </thead>

            <tr class="list-row-odd">
                <td><bean:message key="ssm.misc.index.syspref.notify"/></td>
                <td align="center"><input type="radio" name="notify" value="yes" /></td>
                <td align="center"><input type="radio" name="notify" value="no" /></td>

                <td align="center"><input type="radio" name="notify" value="no_change" checked="1" /></td>
            </tr>

            <tr class="list-row-even">
                <td><bean:message key="ssm.misc.index.syspref.dailysummary"/></td>
                <td align="center"><input type="radio" name="summary" value="yes" /></td>
                <td align="center"><input type="radio" name="summary" value="no" /></td>
                <td align="center"><input type="radio" name="summary" value="no_change" checked="1" /></td>
            </tr>

            <rhn:require acl="all_systems_in_set_have_feature(ftr_auto_errata_updates)">
                <tr class="list-row-odd">
                    <td><bean:message key="ssm.misc.index.syspref.update"/></td>
                    <td align="center"><input type="radio" name="update" value="yes" /></td>
                    <td align="center"><input type="radio" name="update" value="no" /></td>
                    <td align="center"><input type="radio" name="update" value="no_change" checked="1" /></td>
                </tr>
            </rhn:require>
        </table>

        <div class="text-right">
            <hr />

            <input class="btn btn-default" type="submit" name="sscd_change_system_prefs" value="<bean:message key='ssm.misc.index.syspref.changepreferences'/>" />
        </div>

    </form>
</rhn:require>

</body>
</html>
