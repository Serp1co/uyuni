<%@ taglib uri="http://rhn.redhat.com/rhn" prefix="rhn" %>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<%@ taglib uri="http://struts.apache.org/tags-html" prefix="html" %>
<%@ taglib uri="http://struts.apache.org/tags-bean" prefix="bean" %>


<html>
<head>
</head>
<body>
<c:set var="actionLink" value="/rhn/configuration/ChannelCreate.do?editing=true&type=state"/>
<c:set var="actionMessage" value="toolbar.create.state.configchannel"/>
<c:set var="actionIcon" value="item-add"/>

<rhn:toolbar base="h1" icon="header-channel-configuration" miscUrl="${actionLink}" miscIcon="${actionIcon}" miscText="${actionMessage}" miscAlt="${actionMessage}"  miscAcl="authorized_for(config.channels)"
 helpUrl="/docs/${rhn:getDocsLocale(pageContext)}/reference/configuration/config-overview.html"
 creationUrl="/rhn/configuration/ChannelCreate.do?editing=true&type=normal"
 creationType="configchannel"
 creationAcl="authorized_for(config.channels)">
  <bean:message key="globalconfiglist.jsp.toolbar"/>
</rhn:toolbar>

    <p>
    <bean:message key="globalconfiglist.jsp.summary"/>
    </p>

<form method="post" role="form" name="rhn_list" action="/rhn/configuration/GlobalConfigChannelList.do">
  <rhn:csrf />
  <rhn:submitted />

  <rhn:list pageList="${requestScope.pageList}" noDataText="globalconfiglist.jsp.noChannels">
    <rhn:listdisplay filterBy="globalconfiglist.jsp.name">
      <rhn:column header="globalconfiglist.jsp.name"
                  url="/rhn/configuration/ChannelOverview.do?ccid=${current.id}">
        <rhn:icon type="header-channel" title="config.common.globalAlt" />
        ${current.name}
      </rhn:column>

      <rhn:column header="globalconfiglist.jsp.label">
        ${current.label}
      </rhn:column>

      <rhn:column header="globalconfiglist.jsp.type">
              ${current.typeDisplay}
      </rhn:column>

      <rhn:column header="globalconfiglist.jsp.files"
                  url="/rhn/configuration/ChannelFiles.do?ccid=${current.id}"
                  renderUrl="${current.fileCount > 0}">
          <c:out value="${current.fileCountsMessage}"/>
      </rhn:column>

      <rhn:column header="globalconfiglist.jsp.systems"
                  url="/rhn/configuration/channel/ChannelSystems.do?ccid=${current.id}"
                  renderUrl="${current.systemCount > 0}">
        <c:if test="${current.systemCount == 0}">
          <bean:message key="none.message" />
        </c:if>
        <c:if test="${current.systemCount == 1}">
          <bean:message key="system.common.onesystem" />
        </c:if>
        <c:if test="${current.systemCount > 1}">
          <bean:message key="system.common.numsystems" arg0="${current.systemCount}"/>
        </c:if>
      </rhn:column>
    </rhn:listdisplay>
  </rhn:list>

</form>

</body>
</html>
