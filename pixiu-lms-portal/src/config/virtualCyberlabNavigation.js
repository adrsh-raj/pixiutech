export function withVirtualCyberlabNavigation(groups, icon) {
  let hasSimulationLink = false;
  const updatedGroups = groups.map(group => ({
    ...group,
    links: group.links.map(link => {
      if (link.href !== '/simulation') return link;
      hasSimulationLink = true;
      return { ...link, name: 'Virtual Cyberlab', icon };
    }),
  }));

  if (hasSimulationLink) return updatedGroups;

  return [
    ...updatedGroups,
    {
      title: 'VIRTUAL LAB',
      links: [{ name: 'Virtual Cyberlab', href: '/simulation', icon }],
    },
  ];
}
